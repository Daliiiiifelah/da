import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api"; // Import internal
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

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

export const submitRating = mutation({
  args: {
    matchId: v.id("matches"),
    ratedUserId: v.id("users"),
    // stars: v.number(), // Expecting 1-7 // Removed
    suggestion: v.optional(v.string()),
    speedGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    defenseGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    offenseGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    shootingGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    dribblingGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    passingGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
  },
  handler: async (ctx, args) => {
    const raterUser = await getLoggedInUserOrThrow(ctx);

    // Basic validation: at least one attribute must be rated if no suggestion is given
    const anAttributeIsRated = args.speedGiven || args.defenseGiven || args.offenseGiven || args.shootingGiven || args.dribblingGiven || args.passingGiven;
    if (!anAttributeIsRated && !args.suggestion) {
      throw new Error("At least one attribute must be rated or a suggestion provided.");
    }

    // if (args.stars < 1 || args.stars > 7) { // Star validation removed
    //   throw new Error("Star rating must be between 1 and 7.");
    // }

    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found.");
    }
    if (match.status !== "completed") {
      throw new Error("Ratings can only be submitted for completed matches.");
    }

    if (raterUser._id === args.ratedUserId) {
      throw new Error("You cannot rate yourself.");
    }

    const raterParticipation = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", raterUser._id)
      )
      .unique();

    const ratedParticipation = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", args.ratedUserId)
      )
      .unique();

    if (!raterParticipation) {
      throw new Error("Rater did not participate in this match.");
    }
    if (!ratedParticipation) {
      throw new Error("Rated user did not participate in this match.");
    }

    const existingRating = await ctx.db
      .query("playerRatings")
      .withIndex("by_match_and_rater", (q) => q.eq("matchId", args.matchId).eq("raterUserId", raterUser._id))
      .filter((q) => q.eq(q.field("ratedUserId"), args.ratedUserId))
      .unique();

    if (existingRating) {
      throw new Error("You have already rated this player for this match.");
    }

    await ctx.db.insert("playerRatings", {
      matchId: args.matchId,
      raterUserId: raterUser._id,
      ratedUserId: args.ratedUserId,
      // stars: args.stars, // Removed
      suggestion: args.suggestion,
      speedGiven: args.speedGiven,
      defenseGiven: args.defenseGiven,
      offenseGiven: args.offenseGiven,
      shootingGiven: args.shootingGiven,
      dribblingGiven: args.dribblingGiven,
      passingGiven: args.passingGiven,
    });

    // Trigger profile stat aggregation for the rated user
    await ctx.scheduler.runAfter(0, internal.userProfiles.updateAggregatedProfileStats, {
      ratedUserId: args.ratedUserId
    });

    return { success: true };
  },
});

export const getPlayersToRate = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const currentUser = await getLoggedInUserOrThrow(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found.");
    }
    if (match.status !== "completed") {
      return [];
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();

    const usersToRate = await Promise.all(
      participants
        .filter((p) => p.userId !== currentUser._id)
        .map(async (p) => {
          const userDoc = await ctx.db.get(p.userId);
          const userProfileDoc = await ctx.db.query("userProfiles").withIndex("by_userId", q => q.eq("userId", p.userId)).unique();
          const existingRating = await ctx.db
            .query("playerRatings")
            .withIndex("by_match_and_rater", q => q.eq("matchId", args.matchId).eq("raterUserId", currentUser._id))
            .filter(q => q.eq(q.field("ratedUserId"), p.userId))
            .first();
          
          return {
            userId: p.userId,
            name: userProfileDoc?.displayName ?? userDoc?.name ?? userDoc?.email ?? "Unknown Player",
            position: p.position,
            alreadyRated: !!existingRating,
          };
        })
    );
    return usersToRate;
  },
});

// getPlayerAverageRating query removed as it relied on the old 'stars' system.
// The new 'overallScore' in userProfiles serves a similar purpose based on aggregated attribute ratings.

// getPlayerPositionalRatings query removed as it relied on the old 'stars' system.
// Positional performance might be reintroduced later based on aggregated attribute ratings if needed.

// getPlayerSuggestions query removed as its primary context (starsGiven) was removed
// and the UI for displaying suggestions was also removed from UserProfileModal.
// If suggestions are reintroduced, this query will need to be re-evaluated
// based on the new attribute rating system.
