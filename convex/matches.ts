import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
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

export const createMatch = mutation({
  args: {
    // sport: v.string(), // Removed for football-only focus
    location: v.string(),
    dateTime: v.number(),
    playersNeeded: v.number(),
    description: v.optional(v.string()),
    locationAvailable: v.boolean(),
    partyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);

    // Validate team-based constraints: minimum 6 players, maximum 22, must be even
    if (args.playersNeeded < 6 || args.playersNeeded > 22) {
      throw new Error("Players needed must be between 6 and 22 for team matches.");
    }

    if (args.playersNeeded % 2 !== 0) {
      throw new Error("Players needed must be even for team matches (equal teams).");
    }
    if (args.dateTime <= Date.now()) {
      throw new Error("Match date and time must be in the future.");
    }

    // Generate default party name if not provided
    // const defaultPartyName = `${args.sport} at ${args.location}`; // Sport removed
    const defaultPartyName = `Football at ${args.location}`;
    const partyName = args.partyName?.trim() || defaultPartyName;

    // Check if party name is unique (case-insensitive)
    const existingParty = await ctx.db
      .query("matches")
      .filter((q) => q.eq(q.field("partyName"), partyName))
      .first();

    if (existingParty) {
      throw new Error("A party with this name already exists. Please choose a different name.");
    }

    const matchId = await ctx.db.insert("matches", {
      creatorId: user._id,
      // sport: args.sport, // Removed for football-only focus
      location: args.location,
      dateTime: args.dateTime,
      playersNeeded: args.playersNeeded,
      description: args.description,
      status: "open",
      locationAvailable: args.locationAvailable,
      partyName: partyName,
    });
    return matchId;
  },
});

export const searchParties = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      return [];
    }

    const searchTerm = args.searchTerm.toLowerCase().trim();
    
    // Get all matches and filter by party name
    const allMatches = await ctx.db.query("matches").collect();
    
    const filteredMatches = allMatches.filter(match => 
      match.partyName?.toLowerCase().includes(searchTerm) ||
      // match.sport.toLowerCase().includes(searchTerm) || // Sport removed
      match.location.toLowerCase().includes(searchTerm)
    );

    // Get participant counts for each match
    const matchesWithDetails = await Promise.all(
      filteredMatches.map(async (match) => {
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
          .collect();
        
        const creator = await ctx.db.get(match.creatorId);
        
        return {
          ...match,
          participantCount: participants.length,
          participants,
          creatorName: creator?.name ?? creator?.email ?? "Unknown Creator",
        };
      })
    );

    // Sort by creation time (newest first)
    return matchesWithDetails.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listOpenMatches = query({
  args: {},
  handler: async (ctx) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_status_and_dateTime", (q) => q.eq("status", "open"))
      .order("asc") // Show soonest matches first
      .collect();

    return Promise.all(
      matches.map(async (match) => {
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
          .collect();
        return {
          ...match,
          participantCount: participants.length,
          participants, // Include participants for UI
        };
      })
    );
  },
});

export const getMatchDetails = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      return null;
    }
    const participantsDocs = await ctx.db
      .query("participants")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();

    const participants = await Promise.all(
      participantsDocs.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        const userProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", p.userId))
          .unique();
        
        return {
          userId: p.userId,
          userName: userProfile?.displayName ?? user?.name ?? user?.email ?? "Unknown User",
          team: p.team,
          position: p.position,
          _id: p._id,
          _creationTime: p._creationTime,
          matchId: p.matchId,
        };
      })
    );
    
    const creator = await ctx.db.get(match.creatorId);

    return {
      ...match,
      participants,
      participantCount: participants.length,
      creatorName: creator?.name ?? creator?.email ?? "Unknown Creator",
    };
  },
});

export const joinMatch = mutation({
  args: {
    matchId: v.id("matches"),
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
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found.");
    }
    if (match.status !== "open") {
      throw new Error("Match is not open for joining.");
    }

    const existingParticipation = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", user._id)
      )
      .unique();

    if (existingParticipation) {
      throw new Error("User has already joined this match.");
    }

    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();

    if (allParticipants.length >= match.playersNeeded) {
      throw new Error("Match is already full.");
    }

    // Get team-specific participants
    const teamParticipants = allParticipants.filter(p => p.team === args.team);
    const maxPerTeam = match.playersNeeded / 2;

    if (teamParticipants.length >= maxPerTeam) {
      throw new Error(`Team ${args.team} is already full.`);
    }

    // Validate position constraints
    const goalkeepers = teamParticipants.filter(p => p.position === "goalkeeper");
    
    // Goalkeeper limit: 1 per team
    if (args.position === "goalkeeper" && goalkeepers.length >= 1) {
      throw new Error(`Team ${args.team} already has a goalkeeper.`);
    }

    // For field positions, calculate limits based on team size
    if (args.position !== "goalkeeper") {
      const fieldPlayersInTeam = teamParticipants.filter(p => p.position !== "goalkeeper");
      const maxFieldPlayersPerTeam = maxPerTeam - 1; // Subtract 1 for goalkeeper
      const maxPerFieldPosition = Math.ceil(maxFieldPlayersPerTeam / 3); // Divide among 3 field positions
      
      const positionCount = teamParticipants.filter(p => p.position === args.position).length;
      
      if (positionCount >= maxPerFieldPosition) {
        throw new Error(`Team ${args.team} already has the maximum number of ${args.position}s (${maxPerFieldPosition}).`);
      }
    }

    await ctx.db.insert("participants", {
      matchId: args.matchId,
      userId: user._id,
      team: args.team,
      position: args.position,
    });

    // Check if match is now full
    if (allParticipants.length + 1 >= match.playersNeeded) {
      await ctx.db.patch(args.matchId, { status: "full" });
    }
    return { success: true };
  },
});

// New mutation specifically for creators to join their own match
export const creatorJoinMatch = mutation({
  args: {
    matchId: v.id("matches"),
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
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found.");
    }
    
    // Verify user is the creator
    if (match.creatorId !== user._id) {
      throw new Error("Only the match creator can use this function.");
    }

    if (match.status !== "open") {
      throw new Error("Match is not open for joining.");
    }

    const existingParticipation = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", user._id)
      )
      .unique();

    if (existingParticipation) {
      throw new Error("You have already joined this match as a player.");
    }

    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();

    if (allParticipants.length >= match.playersNeeded) {
      throw new Error("Match is already full.");
    }

    // Get team-specific participants
    const teamParticipants = allParticipants.filter(p => p.team === args.team);
    const maxPerTeam = match.playersNeeded / 2;

    if (teamParticipants.length >= maxPerTeam) {
      throw new Error(`Team ${args.team} is already full.`);
    }

    // Validate position constraints
    const goalkeepers = teamParticipants.filter(p => p.position === "goalkeeper");
    
    // Goalkeeper limit: 1 per team
    if (args.position === "goalkeeper" && goalkeepers.length >= 1) {
      throw new Error(`Team ${args.team} already has a goalkeeper.`);
    }

    // For field positions, calculate limits based on team size
    if (args.position !== "goalkeeper") {
      const fieldPlayersInTeam = teamParticipants.filter(p => p.position !== "goalkeeper");
      const maxFieldPlayersPerTeam = maxPerTeam - 1; // Subtract 1 for goalkeeper
      const maxPerFieldPosition = Math.ceil(maxFieldPlayersPerTeam / 3); // Divide among 3 field positions
      
      const positionCount = teamParticipants.filter(p => p.position === args.position).length;
      
      if (positionCount >= maxPerFieldPosition) {
        throw new Error(`Team ${args.team} already has the maximum number of ${args.position}s (${maxPerFieldPosition}).`);
      }
    }

    await ctx.db.insert("participants", {
      matchId: args.matchId,
      userId: user._id,
      team: args.team,
      position: args.position,
    });

    // Check if match is now full
    if (allParticipants.length + 1 >= match.playersNeeded) {
      await ctx.db.patch(args.matchId, { status: "full" });
    }
    return { success: true };
  },
});

export const leaveMatch = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found.");
    }

    const participation = await ctx.db
      .query("participants")
      .withIndex("by_matchId_and_userId", (q) =>
        q.eq("matchId", args.matchId).eq("userId", user._id)
      )
      .unique();

    if (!participation) {
      throw new Error("User has not joined this match.");
    }

    await ctx.db.delete(participation._id);

    // If match was full, it's now open
    if (match.status === "full") {
      await ctx.db.patch(args.matchId, { status: "open" });
    }
     return { success: true };
  },
});

export const cancelMatch = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found.");
    }
    if (match.creatorId !== user._id) {
      throw new Error("Only the creator can cancel the match.");
    }
    if (match.status === "completed" || match.status === "cancelled") {
      throw new Error(`Match is already ${match.status}.`);
    }

    await ctx.db.patch(args.matchId, { status: "cancelled" });
    return { success: true };
  },
});

export const completeMatch = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found.");
    }
    if (match.creatorId !== user._id) {
      throw new Error("Only the creator can mark the match as completed.");
    }
     if (match.status === "completed" || match.status === "cancelled") {
      throw new Error(`Match is already ${match.status}.`);
    }

    await ctx.db.patch(args.matchId, { status: "completed" });
    return { success: true };
  },
});

// Query to get matches created by the logged-in user
export const getMyCreatedMatches = query({
  args: {},
  handler: async (ctx) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_creatorId_and_dateTime", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .collect();
    
    return Promise.all(
      matches.map(async (match) => {
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
          .collect();
        return {
          ...match,
          participantCount: participants.length,
          participants,
        };
      })
    );
  },
});

// Query to get matches joined by the logged-in user
export const getMyJoinedMatches = query({
  args: {},
  handler: async (ctx) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const participations = await ctx.db
      .query("participants")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const matchIds = participations.map((p) => p.matchId);
    const matchesData = await Promise.all(
      matchIds.map(async (matchId) => {
        const match = await ctx.db.get(matchId);
        if (!match) return null;
        const participants = await ctx.db
          .query("participants")
          .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
          .collect();
        return {
          ...match,
          participantCount: participants.length,
          participants, // also return participants here for consistency if MatchCard expects it
        };
      })
    );
    return matchesData.filter((m): m is Doc<"matches"> & { participantCount: number, participants: Doc<"participants">[] } => m !== null).sort((a,b) => b.dateTime - a.dateTime);
  },
});
