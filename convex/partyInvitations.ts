import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

async function getLoggedInUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("User not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Authenticated user record not found.");
  return { ...user, _id: userId };
}

export const sendPartyInvitation = mutation({
  args: {
    matchId: v.id("matches"),
    inviteeId: v.id("users"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inviter = await getLoggedInUserOrThrow(ctx);

    if (inviter._id === args.inviteeId) {
      throw new Error("You cannot invite yourself to a party.");
    }

    // Check if match exists
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found.");
    }

    // Check if match is still open for invitations
    if (match.status === "cancelled" || match.status === "completed") {
      throw new Error("Cannot send invitations for this match.");
    }

    // Check if inviter has permission to invite (creator or participant)
    const isCreator = match.creatorId === inviter._id;
    const isParticipant = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", inviter._id)
      )
      .unique();

    if (!isCreator && !isParticipant) {
      throw new Error("You must be part of the party to send invitations.");
    }

    // Check if invitee is already in the party
    const inviteeIsCreator = match.creatorId === args.inviteeId;
    const inviteeIsParticipant = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", args.inviteeId)
      )
      .unique();

    if (inviteeIsCreator || inviteeIsParticipant) {
      throw new Error("This user is already part of the party.");
    }

    // Check if there's already a pending invitation
    const existingInvitation = await ctx.db
      .query("partyInvitations")
      .withIndex("by_match_and_invitee", (q) =>
        q.eq("matchId", args.matchId).eq("inviteeId", args.inviteeId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingInvitation) {
      throw new Error("There is already a pending invitation for this user.");
    }

    // Check if match is full
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();

    if (participants.length >= match.playersNeeded) {
      throw new Error("The party is already full.");
    }

    // Create the invitation
    const invitationId = await ctx.db.insert("partyInvitations", {
      matchId: args.matchId,
      inviterId: inviter._id,
      inviteeId: args.inviteeId,
      status: "pending",
      message: args.message,
    });

    // Get inviter profile for notification
    const inviterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", inviter._id))
      .unique();

    const inviterName = inviterProfile?.displayName ?? inviter.name ?? inviter.email ?? "Someone";

    // Create notification
    await ctx.runMutation(internal.notifications.createPartyInvitationNotification, {
      userId: args.inviteeId,
      fromUserId: inviter._id,
      partyInvitationId: invitationId,
      matchId: args.matchId,
      message: `${inviterName} invited you to join "${match.partyName || match.sport + ' at ' + match.location}"`,
    });

    return { success: true, message: "Party invitation sent!" };
  },
});

export const acceptPartyInvitation = mutation({
  args: {
    invitationId: v.id("partyInvitations"),
    team: v.union(v.literal("A"), v.literal("B")),
    position: v.union(
      v.literal("goalkeeper"), 
      v.literal("defender"), 
      v.literal("midfielder"), 
      v.literal("forward")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found.");
    }

    if (invitation.inviteeId !== user._id) {
      throw new Error("You can only accept invitations sent to you.");
    }

    if (invitation.status !== "pending") {
      throw new Error("This invitation is no longer pending.");
    }

    const match = await ctx.db.get(invitation.matchId);
    if (!match) {
      throw new Error("Match not found.");
    }

    if (match.status !== "open" && match.status !== "full") {
      throw new Error("This match is no longer accepting participants.");
    }

    // Check if user is already in the party
    const existingParticipation = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", invitation.matchId).eq("userId", user._id)
      )
      .unique();

    if (existingParticipation || match.creatorId === user._id) {
      throw new Error("You are already part of this party.");
    }

    // Check if match is full
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_matchId", (q) => q.eq("matchId", invitation.matchId))
      .collect();

    if (participants.length >= match.playersNeeded) {
      throw new Error("The party is already full.");
    }

    // Accept the invitation
    await ctx.db.patch(args.invitationId, { status: "accepted" });

    // Add user as participant
    await ctx.db.insert("participants", {
      matchId: invitation.matchId,
      userId: user._id,
      team: args.team,
      position: args.position,
    });

    // Update match status if now full
    if (participants.length + 1 >= match.playersNeeded) {
      await ctx.db.patch(invitation.matchId, { status: "full" });
    }

    // Create notification for inviter
    const accepterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const accepterName = accepterProfile?.displayName ?? user.name ?? user.email ?? "Someone";

    await ctx.runMutation(internal.notifications.createPartyInvitationResponseNotification, {
      userId: invitation.inviterId,
      fromUserId: user._id,
      partyInvitationId: args.invitationId,
      matchId: invitation.matchId,
      message: `${accepterName} accepted your party invitation`,
      accepted: true,
    });

    return { success: true, message: "Party invitation accepted!" };
  },
});

export const declinePartyInvitation = mutation({
  args: {
    invitationId: v.id("partyInvitations"),
  },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found.");
    }

    if (invitation.inviteeId !== user._id) {
      throw new Error("You can only decline invitations sent to you.");
    }

    if (invitation.status !== "pending") {
      throw new Error("This invitation is no longer pending.");
    }

    // Decline the invitation
    await ctx.db.patch(args.invitationId, { status: "declined" });

    // Create notification for inviter
    const declinerProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const declinerName = declinerProfile?.displayName ?? user.name ?? user.email ?? "Someone";

    await ctx.runMutation(internal.notifications.createPartyInvitationResponseNotification, {
      userId: invitation.inviterId,
      fromUserId: user._id,
      partyInvitationId: args.invitationId,
      matchId: invitation.matchId,
      message: `${declinerName} declined your party invitation`,
      accepted: false,
    });

    return { success: true, message: "Party invitation declined." };
  },
});

export const getMyPendingInvitations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getLoggedInUserOrThrow(ctx);

    const invitations = await ctx.db
      .query("partyInvitations")
      .withIndex("by_invitee_and_status", (q) =>
        q.eq("inviteeId", user._id).eq("status", "pending")
      )
      .collect();

    return Promise.all(
      invitations.map(async (invitation) => {
        const match = await ctx.db.get(invitation.matchId);
        const inviter = await ctx.db.get(invitation.inviterId);
        const inviterProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", invitation.inviterId))
          .unique();

        return {
          ...invitation,
          match,
          inviterName: inviterProfile?.displayName ?? inviter?.name ?? inviter?.email ?? "Unknown User",
          inviterProfileImageUrl: inviterProfile?.profileImageUrl ?? null,
        };
      })
    );
  },
});

export const getMySentInvitations = query({
  args: { matchId: v.optional(v.id("matches")) },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);

    let invitations;
    if (args.matchId) {
      invitations = await ctx.db
        .query("partyInvitations")
        .withIndex("by_match_and_inviter", (q) => q.eq("matchId", args.matchId!).eq("inviterId", user._id))
        .collect();
    } else {
      invitations = await ctx.db
        .query("partyInvitations")
        .filter((q) => q.eq(q.field("inviterId"), user._id))
        .collect();
    }

    return Promise.all(
      invitations.map(async (invitation) => {
        const match = await ctx.db.get(invitation.matchId);
        const invitee = await ctx.db.get(invitation.inviteeId);
        const inviteeProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", invitation.inviteeId))
          .unique();

        return {
          ...invitation,
          match,
          inviteeName: inviteeProfile?.displayName ?? invitee?.name ?? invitee?.email ?? "Unknown User",
          inviteeProfileImageUrl: inviteeProfile?.profileImageUrl ?? null,
        };
      })
    );
  },
});
