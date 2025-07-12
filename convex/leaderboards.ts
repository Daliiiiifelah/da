import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

const MIN_RATINGS_FOR_LEADERBOARD = 3; // Minimum number of ratings received to appear on leaderboard

export const getOverallWorldwideLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20; // Default to top 20

    // Fetch all user profiles that have an overallScore and meet the minimum ratings count
    // We will sort and limit in application code after fetching, as Convex query sorting on optional fields can be tricky.
    // Alternatively, ensure overallScore is always set (e.g. to 0) if a user has a profile.
    // For now, filter for non-null overallScore.
    const profiles = await ctx.db
      .query("userProfiles")
      .filter(q => q.neq(q.field("overallScore"), null)) // Ensure overallScore is calculated
      .filter(q => q.gte(q.field("ratingsCount"), MIN_RATINGS_FOR_LEADERBOARD)) // Ensure minimum ratings
      .collect();

    // Sort by overallScore descending. If scores are equal, could add secondary sort (e.g., by ratingsCount, then displayName)
    const sortedProfiles = profiles.sort((a, b) => {
      if (b.overallScore === null && a.overallScore === null) return 0;
      if (b.overallScore === null) return -1; // a comes first if b is null
      if (a.overallScore === null) return 1;  // b comes first if a is null

      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      // Secondary sort by ratingsCount if overallScore is the same
      if (b.ratingsCount && a.ratingsCount && b.ratingsCount !== a.ratingsCount) {
        return b.ratingsCount - a.ratingsCount;
      }
      // Tertiary sort by displayName if both overallScore and ratingsCount are the same
      return (a.displayName ?? "").localeCompare(b.displayName ?? "");
    });

    const leaderboardData = await Promise.all(
        sortedProfiles.slice(0, limit).map(async (profile) => {
        // We need the user document for the _id typically used in frontend for user context,
        // though profile.userId is the same.
        // If userProfiles._id is the one used for profile pages, then fetching user doc might not be needed here.
        // Assuming profile.userId is sufficient for linking.
        // const user = await ctx.db.get(profile.userId); // Not strictly needed if profile has all display info

        return {
          userId: profile.userId, // This is Id<"users">
          uniqueUserId: profile.uniqueUserId,
          displayName: profile.displayName,
          profileImageUrl: profile.profileImageUrl,
          overallScore: profile.overallScore,
          country: profile.country,
          ratingsCount: profile.ratingsCount,
        };
      })
    );

    return leaderboardData;
  },
});
