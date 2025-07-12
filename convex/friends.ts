import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper to get logged-in user or throw error
async function getLoggedInUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not authenticated.");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found.");
  }
  return user;
}

export const sendFriendRequest = mutation({
  args: { requesteeId: v.id("users") },
  handler: async (ctx, args) => {
    const requester = await getLoggedInUserOrThrow(ctx);
    const requesterId = requester._id;
    const { requesteeId } = args;

    if (requesterId === requesteeId) {
      throw new Error("You cannot send a friend request to yourself.");
    }

    // Check if a request already exists between these two users (in either direction)
    const existingRequest = await ctx.db
      .query("friendRequests")
      .filter(q =>
        q.or(
          q.and(q.eq(q.field("requesterId"), requesterId), q.eq(q.field("requesteeId"), requesteeId)),
          q.and(q.eq(q.field("requesterId"), requesteeId), q.eq(q.field("requesteeId"), requesterId))
        )
      )
      .first();

    if (existingRequest) {
        if (existingRequest.status === "removed" || existingRequest.status === "declined") {
            // If the friendship was removed or declined, allow a new request by patching the old one.
            // This prevents cluttering the database with multiple requests between the same two users.
            await ctx.db.patch(existingRequest._id, {
                requesterId: requesterId, // Ensure the sender is the current user
                requesteeId: requesteeId,
                status: "pending"
            });
            return { success: true, isNew: false, requestId: existingRequest._id };
        } else {
            throw new Error("A friend request already exists and is either pending or accepted.");
        }
    }

    const requestId = await ctx.db.insert("friendRequests", {
      requesterId,
      requesteeId,
      status: "pending",
    });

    return { success: true, isNew: true, requestId };
  },
});

export const acceptFriendRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Friend request not found.");
    }

    if (request.requesteeId !== user._id) {
      throw new Error("You are not authorized to accept this friend request.");
    }

    if (request.status !== "pending") {
      throw new Error(`Cannot accept a request with status: ${request.status}`);
    }

    await ctx.db.patch(args.requestId, { status: "accepted" });
  },
});

export const declineFriendRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Friend request not found.");
    }

    // Allow either the requestee or the original requester (if they want to cancel) to decline/cancel.
    if (request.requesteeId !== user._id && request.requesterId !== user._id) {
      throw new Error("You are not authorized to alter this friend request.");
    }

    if (request.status !== "pending") {
      throw new Error(`Cannot decline a request with status: ${request.status}`);
    }

    await ctx.db.patch(args.requestId, { status: "declined" });
  },
});

export const removeFriend = mutation({
  args: { friendshipId: v.id("friendRequests") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const friendship = await ctx.db.get(args.friendshipId);

    if (!friendship) {
      throw new Error("Friendship not found.");
    }

    // Ensure the user is part of this friendship
    if (friendship.requesterId !== user._id && friendship.requesteeId !== user._id) {
      throw new Error("You are not part of this friendship.");
    }

    if (friendship.status !== "accepted") {
      throw new Error("Cannot remove a friend that is not in 'accepted' status.");
    }

    await ctx.db.patch(args.friendshipId, { status: "removed" });
  },
});


// --- QUERIES ---

// Get the status of a friendship between the logged-in user and another user
export const getFriendshipStatus = query({
    args: { otherUserId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await getLoggedInUserOrThrow(ctx);

        const friendship = await ctx.db
            .query("friendRequests")
            .filter(q =>
                q.or(
                    q.and(q.eq(q.field("requesterId"), user._id), q.eq(q.field("requesteeId"), args.otherUserId)),
                    q.and(q.eq(q.field("requesterId"), args.otherUserId), q.eq(q.field("requesteeId"), user._id))
                )
            )
            // Do not filter by "removed" here, so the UI knows a friendship once existed.
            .first();

        return friendship;
    },
});

// List all users who are friends with the current user
export const listFriends = query({
    handler: async (ctx) => {
        const user = await getLoggedInUserOrThrow(ctx);

        const friendships = await ctx.db
            .query("friendRequests")
            .filter(q => q.and(
                q.eq(q.field("status"), "accepted"),
                q.or(
                    q.eq(q.field("requesterId"), user._id),
                    q.eq(q.field("requesteeId"), user._id)
                )
            ))
            .collect();

        const friendUserIds = friendships.map(f => f.requesterId === user._id ? f.requesteeId : f.requesterId);

        if (friendUserIds.length === 0) {
            return [];
        }

        const friendProfiles = await Promise.all(
            friendUserIds.map(friendId =>
                ctx.db.query("userProfiles").withIndex("by_userId", q => q.eq("userId", friendId)).unique()
            )
        );

        // Filter out any null profiles in case a user profile doesn't exist for some reason
        return friendProfiles.filter(p => p !== null);
    }
});

// List all pending friend requests for the current user
export const listPendingFriendRequests = query({
    handler: async (ctx) => {
        const user = await getLoggedInUserOrThrow(ctx);

        const requests = await ctx.db
            .query("friendRequests")
            .withIndex("by_requestee_and_status", q => q.eq("requesteeId", user._id).eq("status", "pending"))
            .collect();

        const requestsWithDetails = await Promise.all(
            requests.map(async (req) => {
                const requesterProfile = await ctx.db
                    .query("userProfiles")
                    .withIndex("by_userId", q => q.eq("userId", req.requesterId))
                    .unique();
                return {
                    ...req,
                    requesterName: requesterProfile?.displayName ?? "Unknown Egoist",
                    requesterImageUrl: requesterProfile?.profileImageUrl,
                };
            })
        );

        return requestsWithDetails;
    }
});
