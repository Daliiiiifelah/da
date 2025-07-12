import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

const MIN_RATINGS_FOR_LEADERBOARD = 3; // Minimum number of ratings received to appear on leaderboard

export const getOverallWorldwideLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
    position: v.optional(v.union(
      v.literal("goalkeeper"),
      v.literal("defender"),
      v.literal("midfielder"),
      v.literal("forward")
    )),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50; // Increased default limit

    // Start with a base query for profiles that are eligible for the leaderboard
    let profiles = await ctx.db
      .query("userProfiles")
      .filter(q => q.and(
        q.neq(q.field("overallScore"), null),
        q.gte(q.field("ratingsCount"), MIN_RATINGS_FOR_LEADERBOARD)
      ))
      .collect();

    // Apply filters in-memory
    if (args.position) {
      profiles = profiles.filter(p => p.favoritePosition === args.position);
    }
    if (args.country) {
      profiles = profiles.filter(p => p.country === args.country);
    }

    // Sort the filtered profiles
    const sortedProfiles = profiles.sort((a, b) => {
      // Primary sort: overallScore descending
      if (a.overallScore !== b.overallScore) {
        return (b.overallScore ?? 0) - (a.overallScore ?? 0);
      }
      // Secondary sort: ratingsCount descending
      if (a.ratingsCount !== b.ratingsCount) {
        return (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0);
      }
      // Tertiary sort: displayName ascending
      return (a.displayName ?? "").localeCompare(b.displayName ?? "");
    });

    // Return the top N results after slicing
    return sortedProfiles.slice(0, limit);
  },
});
