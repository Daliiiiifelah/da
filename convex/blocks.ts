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
      let existing = await ctx.db
        .query("friendRequests")
        .withIndex("by_requester_and_requestee", (q) =>
          q.eq("requesterId", user1Id).eq("requesteeId", user2Id)
        )
        .first();
      if (existing) return existing;
      existing = await ctx.db
        .query("friendRequests")
        .withIndex("by_requester_and_requestee", (q) =>
          q.eq("requesterId", user2Id).eq("requesteeId", user1Id)
        )
        .first();
      return existing;
    }

    export const blockUser = mutation({
      args: {
        blockedId: v.id("users"),
        reason: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const blocker = await getLoggedInUserOrThrow(ctx);
        const blockerId = blocker._id;

        if (blockerId === args.blockedId) {
          throw new Error("You cannot block yourself.");
        }

        const existingBlock = await ctx.db
          .query("blockedUsers")
          .withIndex("by_blocker_and_blocked", (q) =>
            q.eq("blockerId", blockerId).eq("blockedId", args.blockedId)
          )
          .unique();

        if (existingBlock) {
          // Optionally update reason if already blocked
          if (args.reason && existingBlock.reason !== args.reason) {
            await ctx.db.patch(existingBlock._id, { reason: args.reason });
          }
          throw new Error("User already blocked.");
        }

        await ctx.db.insert("blockedUsers", {
          blockerId,
          blockedId: args.blockedId,
          reason: args.reason,
        });

        // Remove any existing friendship or pending requests
        const friendRequest = await findExistingFriendRequest(ctx, blockerId, args.blockedId);
        if (friendRequest && (friendRequest.status === "pending" || friendRequest.status === "accepted")) {
          await ctx.db.patch(friendRequest._id, { status: "removed" }); 
        }

        return { success: true, message: "User blocked." };
      },
    });

    export const unblockUser = mutation({
      args: {
        blockedId: v.id("users"),
      },
      handler: async (ctx, args) => {
        const blocker = await getLoggedInUserOrThrow(ctx);
        const blockerId = blocker._id;

        const existingBlock = await ctx.db
          .query("blockedUsers")
          .withIndex("by_blocker_and_blocked", (q) =>
            q.eq("blockerId", blockerId).eq("blockedId", args.blockedId)
          )
          .unique();

        if (!existingBlock) {
          throw new Error("User is not blocked by you.");
        }

        await ctx.db.delete(existingBlock._id);
        return { success: true, message: "User unblocked." };
      },
    });

    export const getBlockStatus = query({
      args: { otherUserId: v.id("users") },
      handler: async (ctx, args) => {
        const currentUser = await getLoggedInUserOrThrow(ctx);
        if (currentUser._id === args.otherUserId) return { status: "self" };

        const blockedByYou = await ctx.db
          .query("blockedUsers")
          .withIndex("by_blocker_and_blocked", (q) =>
            q.eq("blockerId", currentUser._id).eq("blockedId", args.otherUserId)
          )
          .unique();
        if (blockedByYou) return { status: "blocked_by_you", blockId: blockedByYou._id };

        const blockedYou = await ctx.db
          .query("blockedUsers")
          .withIndex("by_blocker_and_blocked", (q) => // Querying from other user's perspective
            q.eq("blockerId", args.otherUserId).eq("blockedId", currentUser._id)
          )
          .unique();
        if (blockedYou) return { status: "blocked_you", blockId: null }; // Don't expose their blockId

        return { status: "not_blocked", blockId: null };
      },
    });
    
    export const listMyBlockedUsers = query({
        args: {},
        handler: async (ctx) => {
            const currentUser = await getLoggedInUserOrThrow(ctx);
            const blocks = await ctx.db
                .query("blockedUsers")
                .withIndex("by_blocker_and_blocked", q => q.eq("blockerId", currentUser._id))
                .collect();

            return Promise.all(
                blocks.map(async (block) => {
                    const userDoc = await ctx.db.get(block.blockedId);
                    const userProfileDoc = await ctx.db.query("userProfiles").withIndex("by_userId", q => q.eq("userId", block.blockedId)).unique();
                    const profileImageUrl = userProfileDoc?.profileImageUrl ?? null;
                    return {
                        _id: block.blockedId, // The ID of the user who is blocked
                        blockRecordId: block._id, // The ID of the block record itself
                        name: userProfileDoc?.displayName ?? userDoc?.name ?? userDoc?.email ?? "Blocked User",
                        displayName: userProfileDoc?.displayName ?? null,
                        profileImageUrl: profileImageUrl,
                        reason: block.reason,
                    };
                })
            );
        }
    });
