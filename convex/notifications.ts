import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

async function getLoggedInUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("User not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Authenticated user record not found.");
  return { ...user, _id: userId };
}

export const createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("friend_request_received"),
      v.literal("friend_request_accepted"),
      v.literal("friend_request_declined")
    ),
    fromUserId: v.optional(v.id("users")),
    friendRequestId: v.optional(v.id("friendRequests")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      fromUserId: args.fromUserId,
      friendRequestId: args.friendRequestId,
      message: args.message,
      isRead: false,
    });
  },
});

export const createPartyInvitationNotification = internalMutation({
  args: {
    userId: v.id("users"),
    fromUserId: v.id("users"),
    partyInvitationId: v.id("partyInvitations"),
    matchId: v.id("matches"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "party_invitation_received",
      fromUserId: args.fromUserId,
      partyInvitationId: args.partyInvitationId,
      matchId: args.matchId,
      message: args.message,
      isRead: false,
    });
  },
});

export const createPartyInvitationResponseNotification = internalMutation({
  args: {
    userId: v.id("users"),
    fromUserId: v.id("users"),
    partyInvitationId: v.id("partyInvitations"),
    matchId: v.id("matches"),
    message: v.string(),
    accepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.accepted ? "party_invitation_accepted" : "party_invitation_declined",
      fromUserId: args.fromUserId,
      partyInvitationId: args.partyInvitationId,
      matchId: args.matchId,
      message: args.message,
      isRead: false,
    });
  },
});

export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    // Get user details for notifications that have fromUserId
    const notificationsWithDetails = await Promise.all(
      notifications.map(async (notification) => {
        let fromUserName = null;
        let fromUserProfileImageUrl = null;
        let matchName = null;
        
        if (notification.fromUserId) {
          const fromUser = await ctx.db.get(notification.fromUserId);
          const fromUserProfile = await ctx.db
            .query("userProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", notification.fromUserId!))
            .unique();
          
          fromUserName = fromUserProfile?.displayName ?? fromUser?.name ?? fromUser?.email ?? "Unknown User";
          fromUserProfileImageUrl = fromUserProfile?.profileImageUrl ?? null;
        }

        if (notification.matchId) {
          const match = await ctx.db.get(notification.matchId);
          matchName = match?.partyName ?? `${match?.sport} at ${match?.location}` ?? "Unknown Match";
        }

        return {
          ...notification,
          fromUserName,
          fromUserProfileImageUrl,
          matchName,
        };
      })
    );

    return notificationsWithDetails;
  },
});

export const getUnreadNotificationCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      return 0;
    }
    
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_isRead", (q) => 
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    return unreadNotifications.length;
  },
});

export const markNotificationAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found.");
    }

    if (notification.userId !== currentUser._id) {
      throw new Error("You can only mark your own notifications as read.");
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

export const markAllNotificationsAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_isRead", (q) => 
        q.eq("userId", currentUser._id).eq("isRead", false)
      )
      .collect();

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, { isRead: true });
    }
  },
});
