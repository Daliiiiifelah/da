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

async function findExistingFriendRequest(
  ctx: QueryCtx | MutationCtx,
  user1Id: Id<"users">,
  user2Id: Id<"users">
): Promise<Doc<"friendRequests"> | null> {
  // Check if there's a request from user1 to user2
  let existing = await ctx.db
    .query("friendRequests")
    .withIndex("by_requester_and_requestee", (q) =>
      q.eq("requesterId", user1Id).eq("requesteeId", user2Id)
    )
    .first();
  if (existing) return existing;

  // Check if there's a request from user2 to user1
  existing = await ctx.db
    .query("friendRequests")
    .withIndex("by_requester_and_requestee", (q) =>
      q.eq("requesterId", user2Id).eq("requesteeId", user1Id)
    )
    .first();
  return existing;
}

export const sendFriendRequest = mutation({
  args: {
    requesteeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const requester = await getLoggedInUserOrThrow(ctx);
    const requesterId = requester._id;

    if (requesterId === args.requesteeId) {
      throw new Error("You cannot send a friend request to yourself.");
    }

    // Check if the requestee exists
    const requestee = await ctx.db.get(args.requesteeId);
    if (!requestee) {
      throw new Error("The user you're trying to add does not exist.");
    }

    // Check for blocking
    const isBlocked = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_and_blocked", (q) =>
        q.eq("blockerId", args.requesteeId).eq("blockedId", requesterId)
      )
      .unique();
    
    const hasBlocked = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_and_blocked", (q) =>
        q.eq("blockerId", requesterId).eq("blockedId", args.requesteeId)
      )
      .unique();

    if (isBlocked || hasBlocked) {
      throw new Error("Cannot send friend request due to blocking.");
    }

    // Check if there's already a friend request or friendship
    const existingRequest = await findExistingFriendRequest(ctx, requesterId, args.requesteeId);
    
    if (existingRequest) {
      if (existingRequest.status === "pending") {
        throw new Error("A friend request is already pending between you and this user.");
      }
      if (existingRequest.status === "accepted") {
        throw new Error("You are already friends with this user.");
      }
      if (existingRequest.status === "declined") {
        // Allow sending a new request after a decline
        await ctx.db.patch(existingRequest._id, {
          requesterId,
          requesteeId: args.requesteeId,
          status: "pending",
        });

        // Create notification for the requestee
        const requesterProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", requesterId))
          .unique();
        
        const requesterName = requesterProfile?.displayName ?? requester.name ?? requester.email ?? "Someone";
        
        await ctx.runMutation(internal.notifications.createNotification, {
          userId: args.requesteeId,
          type: "friend_request_received",
          fromUserId: requesterId,
          friendRequestId: existingRequest._id,
          message: `${requesterName} sent you a friend request`,
        });

        return { success: true, message: "Friend request sent!" };
      }
    }

    // Create new friend request
    const friendRequestId = await ctx.db.insert("friendRequests", {
      requesterId,
      requesteeId: args.requesteeId,
      status: "pending",
    });

    // Create notification for the requestee
    const requesterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", requesterId))
      .unique();
    
    const requesterName = requesterProfile?.displayName ?? requester.name ?? requester.email ?? "Someone";
    
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: args.requesteeId,
      type: "friend_request_received",
      fromUserId: requesterId,
      friendRequestId,
      message: `${requesterName} sent you a friend request`,
    });

    return { success: true, message: "Friend request sent!" };
  },
});

export const acceptFriendRequest = mutation({
  args: {
    friendRequestId: v.id("friendRequests"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    const friendRequest = await ctx.db.get(args.friendRequestId);
    if (!friendRequest) {
      throw new Error("Friend request not found.");
    }

    if (friendRequest.requesteeId !== currentUser._id) {
      throw new Error("You can only accept friend requests sent to you.");
    }

    if (friendRequest.status !== "pending") {
      throw new Error("This friend request is no longer pending.");
    }

    // Update the friend request status to accepted
    await ctx.db.patch(args.friendRequestId, { status: "accepted" });

    // Create notification for the requester
    const accepterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
      .unique();
    
    const accepterName = accepterProfile?.displayName ?? currentUser.name ?? currentUser.email ?? "Someone";
    
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: friendRequest.requesterId,
      type: "friend_request_accepted",
      fromUserId: currentUser._id,
      friendRequestId: args.friendRequestId,
      message: `${accepterName} accepted your friend request`,
    });

    return { success: true, message: "Friend request accepted!" };
  },
});

export const declineFriendRequest = mutation({
  args: {
    friendRequestId: v.id("friendRequests"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    const friendRequest = await ctx.db.get(args.friendRequestId);
    if (!friendRequest) {
      throw new Error("Friend request not found.");
    }

    // Allow both requester and requestee to decline/cancel
    if (friendRequest.requesteeId !== currentUser._id && friendRequest.requesterId !== currentUser._id) {
      throw new Error("You can only decline friend requests involving you.");
    }

    if (friendRequest.status !== "pending") {
      throw new Error("This friend request is no longer pending.");
    }

    // Update the friend request status to declined
    await ctx.db.patch(args.friendRequestId, { status: "declined" });

    // Create notification only if the requestee declined (not if requester cancelled)
    if (friendRequest.requesteeId === currentUser._id) {
      const declinerProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
        .unique();
      
      const declinerName = declinerProfile?.displayName ?? currentUser.name ?? currentUser.email ?? "Someone";
      
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: friendRequest.requesterId,
        type: "friend_request_declined",
        fromUserId: currentUser._id,
        friendRequestId: args.friendRequestId,
        message: `${declinerName} declined your friend request`,
      });
    }

    return { success: true, message: "Friend request declined." };
  },
});

export const removeFriend = mutation({
  args: {
    friendUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    if (currentUser._id === args.friendUserId) {
      throw new Error("You cannot remove yourself as a friend.");
    }

    // Find the accepted friend request
    const friendRequest = await findExistingFriendRequest(ctx, currentUser._id, args.friendUserId);
    
    if (!friendRequest || friendRequest.status !== "accepted") {
      throw new Error("You are not friends with this user.");
    }

    // Update the friend request status to removed
    await ctx.db.patch(friendRequest._id, { status: "removed" });

    return { success: true, message: "Friend removed." };
  },
});

export const getFriendshipStatus = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    if (currentUser._id === args.otherUserId) {
      return { status: "self" };
    }

    const friendRequest = await findExistingFriendRequest(ctx, currentUser._id, args.otherUserId);
    
    if (!friendRequest) {
      return { status: "not_friends", requestId: null };
    }

    switch (friendRequest.status) {
      case "pending":
        if (friendRequest.requesterId === currentUser._id) {
          return { status: "pending_sent", requestId: friendRequest._id };
        } else {
          return { status: "pending_received", requestId: friendRequest._id };
        }
      case "accepted":
        return { status: "friends", requestId: friendRequest._id };
      case "declined":
      case "removed":
        return { status: "not_friends", requestId: null };
      default:
        return { status: "not_friends", requestId: null };
    }
  },
});

export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    // Get all accepted friend requests involving the current user
    const friendRequests = await ctx.db
      .query("friendRequests")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "accepted"),
          q.or(
            q.eq(q.field("requesterId"), currentUser._id),
            q.eq(q.field("requesteeId"), currentUser._id)
          )
        )
      )
      .collect();

    // Get friend user IDs
    const friendUserIds = friendRequests.map((req) =>
      req.requesterId === currentUser._id ? req.requesteeId : req.requesterId
    );

    // Get user details and profiles for each friend
    const friends = await Promise.all(
      friendUserIds.map(async (friendId) => {
        const userDoc = await ctx.db.get(friendId);
        const userProfileDoc = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", friendId))
          .unique();

        const profileImageUrl = userProfileDoc?.profileImageUrl ?? null;

        return {
          _id: friendId,
          name: userDoc?.name ?? userDoc?.email ?? "Unknown User",
          displayName: userProfileDoc?.displayName ?? null,
          profileImageUrl: profileImageUrl,
          uniqueUserId: userProfileDoc?.uniqueUserId ?? null,
          friendRequestId: friendRequests.find(req => 
            req.requesterId === friendId || req.requesteeId === friendId
          )?._id,
        };
      })
    );

    return friends;
  },
});

export const listPendingIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    // Get pending friend requests sent to the current user
    const pendingRequests = await ctx.db
      .query("friendRequests")
      .withIndex("by_requestee_and_status", (q) =>
        q.eq("requesteeId", currentUser._id).eq("status", "pending")
      )
      .collect();

    // Get requester details for each request
    const requestsWithDetails = await Promise.all(
      pendingRequests.map(async (request) => {
        const requesterDoc = await ctx.db.get(request.requesterId);
        const requesterProfileDoc = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", request.requesterId))
          .unique();

        const requesterProfileImageUrl = requesterProfileDoc?.profileImageUrl ?? null;

        return {
          ...request,
          requesterName: requesterProfileDoc?.displayName ?? requesterDoc?.name ?? requesterDoc?.email ?? "Unknown User",
          requesterProfileImageUrl: requesterProfileImageUrl,
          requesterUniqueUserId: requesterProfileDoc?.uniqueUserId ?? null,
        };
      })
    );

    return requestsWithDetails;
  },
});

export const listPendingOutgoingRequests = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    
    // Get pending friend requests sent by the current user
    const pendingRequests = await ctx.db
      .query("friendRequests")
      .withIndex("by_requester_and_status", (q) =>
        q.eq("requesterId", currentUser._id).eq("status", "pending")
      )
      .collect();

    // Get requestee details for each request
    const requestsWithDetails = await Promise.all(
      pendingRequests.map(async (request) => {
        const requesteeDoc = await ctx.db.get(request.requesteeId);
        const requesteeProfileDoc = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", request.requesteeId))
          .unique();

        const requesteeProfileImageUrl = requesteeProfileDoc?.profileImageUrl ?? null;

        return {
          ...request,
          requesteeName: requesteeProfileDoc?.displayName ?? requesteeDoc?.name ?? requesteeDoc?.email ?? "Unknown User",
          requesteeProfileImageUrl: requesteeProfileImageUrl,
          requesteeUniqueUserId: requesteeProfileDoc?.uniqueUserId ?? null,
        };
      })
    );

    return requestsWithDetails;
  },
});
