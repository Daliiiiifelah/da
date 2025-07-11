import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
    import { v } from "convex/values";
    import { getAuthUserId } from "@convex-dev/auth/server";
    import { Doc, Id } from "./_generated/dataModel";

    async function getLoggedInUserOrThrow(ctx: QueryCtx | MutationCtx) {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("User not authenticated. Please log in.");
      }
      const user = await ctx.db.get(userId);
      if (!user) {
        // This case should ideally not happen if userId is valid
        throw new Error("Authenticated user record not found.");
      }
      return { ...user, _id: userId }; // Ensure _id is the auth user ID
    }

    export const sendMessage = mutation({
      args: {
        matchId: v.id("matches"),
        messageText: v.string(),
      },
      handler: async (ctx, args) => {
        const user = await getLoggedInUserOrThrow(ctx);

        if (args.messageText.trim().length === 0) {
          throw new Error("Message cannot be empty.");
        }
        if (args.messageText.length > 500) { // Basic length check
            throw new Error("Message is too long (max 500 characters).");
        }

        const match = await ctx.db.get(args.matchId);
        if (!match) {
          throw new Error("Match not found.");
        }
        // Optional: Check if user is a participant or creator of the match
        const isCreator = match.creatorId === user._id;
        const participation = await ctx.db
          .query("participants")
          .withIndex("by_matchId_and_userId", (q) =>
            q.eq("matchId", args.matchId).eq("userId", user._id)
          )
          .unique();

        if (!isCreator && !participation) {
          throw new Error("You are not part of this match's party chat.");
        }
        
        // Do not allow chat on cancelled or completed matches by default
        if (match.status === "cancelled" || match.status === "completed") {
            throw new Error(`Chat is closed for ${match.status} matches.`);
        }


        await ctx.db.insert("chatMessages", {
          matchId: args.matchId,
          userId: user._id,
          messageText: args.messageText.trim(),
        });
      },
    });

    export const listMessages = query({
      args: { matchId: v.id("matches") },
      handler: async (ctx, args) => {
        // Optional: Add check if current user can view messages for this match
        // const user = await getLoggedInUserOrThrow(ctx); // If auth is needed to view
        // const match = await ctx.db.get(args.matchId);
        // if (!match) return []; // Or throw error
        // Check participation or creator status if chat is private

        const messages = await ctx.db
          .query("chatMessages")
          .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId)) // Corrected index name here
          .order("asc") // Show oldest messages first
          .collect();

        // Enrich messages with author display name
        return Promise.all(
          messages.map(async (message) => {
            const author = await ctx.db.get(message.userId);
            const authorProfile = await ctx.db.query("userProfiles").withIndex("by_userId", q => q.eq("userId", message.userId)).unique();
            
            const authorProfileImageUrl = authorProfile?.profileImageUrl ?? null;

            // Create unique display name for this match
            const baseDisplayName = authorProfile?.displayName ?? author?.name ?? "Egoist";
            const authorName = `${baseDisplayName}#${message.userId.slice(-4)}`;
            
            return {
              ...message,
              authorName,
              authorProfileImageUrl,
            };
          })
        );
      },
    });
