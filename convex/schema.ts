import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  matches: defineTable({
    creatorId: v.id("users"),
    // sport: v.string(), // Removed for football-only focus
    location: v.string(),
    dateTime: v.number(), 
    playersNeeded: v.number(),
    description: v.optional(v.string()),
    status: v.string(), 
    locationAvailable: v.boolean(),
    partyName: v.optional(v.string()), // Custom party name for searching
    // Venue Details
    venueName: v.optional(v.string()),
    address: v.optional(v.string()),
    pitchType: v.optional(v.union(
      v.literal("grass"),
      v.literal("artificial_turf"),
      v.literal("indoor_court"),
      v.literal("dirt"),
      v.literal("other")
    )),
    amenities: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
      v.literal("open_to_all")
    )),
  })
    .index("by_creatorId_and_dateTime", ["creatorId", "dateTime"])
    .index("by_status_and_dateTime", ["status", "dateTime"])
    .index("by_partyName", ["partyName"]),

  participants: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"),
    team: v.optional(v.union(v.literal("A"), v.literal("B"))), // Team A (blue) or Team B (red) - optional for backward compatibility
    position: v.union(
      v.literal("goalkeeper"), 
      v.literal("defender"), 
      v.literal("midfielder"), 
      v.literal("forward"),
      // Legacy capitalized positions for existing data
      v.literal("Goalkeeper"), 
      v.literal("Defender"), 
      v.literal("Midfielder"), 
      v.literal("Forward"),
      v.literal("Substitute")
    ),
  })
    .index("by_matchId_and_userId", ["matchId", "userId"])
    .index("by_matchId", ["matchId"])
    .index("by_userId", ["userId"])
    .index("by_matchId_and_team", ["matchId", "team"]),

  playerRatings: defineTable({
    matchId: v.id("matches"),
    raterUserId: v.id("users"),
    ratedUserId: v.id("users"),
    // stars: v.number(), // Removed: Replaced by attribute-specific ratings
    suggestion: v.optional(v.string()),
    // S-D grade given by the rater for each attribute
    speedGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    defenseGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    offenseGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    shootingGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    dribblingGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
    passingGiven: v.optional(v.union(v.literal("S"), v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"))),
  })
    .index("by_match_and_rater", ["matchId", "raterUserId"])
    .index("by_ratedUser", ["ratedUserId"])
    .index("by_match_and_ratedUser", ["matchId", "ratedUserId"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    uniqueUserId: v.optional(v.string()), // 8-character unique ID like "ABC12345"
    displayName: v.optional(v.string()), 
    profileImageUrl: v.optional(v.string()),
    profileImageStorageId: v.optional(v.id("_storage")), // Legacy field for migration
    bio: v.optional(v.string()),
    favoritePosition: v.optional(v.union(
      v.literal("goalkeeper"),
      v.literal("defender"),
      v.literal("midfielder"),
      v.literal("forward")
    )),
    location: v.optional(v.string()), // User-defined general location string
    age: v.optional(v.number()),
    // skillLevel: v.optional(v.union( // To be removed, replaced by aggregated hexagon stats
    //   v.literal("beginner"),
    //   v.literal("intermediate"),
    //   v.literal("advanced"),
    //   v.literal("professional")
    // )),
    // Hexagon Stats (0-100 scale) - These will be populated by peer-rating aggregation
    speed: v.optional(v.number()),
    // durability: v.optional(v.number()), // Removed, focusing on 6 core stats for hexagon
    defense: v.optional(v.number()),
    offense: v.optional(v.number()),
    passing: v.optional(v.number()),
    shooting: v.optional(v.number()),
    dribbling: v.optional(v.number()),

    // Fields for Leaderboards
    country: v.optional(v.string()),
    overallScore: v.optional(v.number()), // Calculated average of the 6 core stats (0-100)
    ratingsCount: v.optional(v.number()), // Total number of rating entries received by this user

    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_uniqueUserId", ["uniqueUserId"]),

  chatMessages: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"), 
    messageText: v.string(),
  }).index("by_matchId", ["matchId"]),

  partyInvitations: defineTable({
    matchId: v.id("matches"),
    inviterId: v.id("users"), // Who sent the invitation
    inviteeId: v.id("users"), // Who received the invitation
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    message: v.optional(v.string()), // Optional invitation message
  })
    .index("by_invitee_and_status", ["inviteeId", "status"])
    .index("by_match_and_invitee", ["matchId", "inviteeId"])
    .index("by_match_and_inviter", ["matchId", "inviterId"]), 

  friendRequests: defineTable({
    requesterId: v.id("users"),
    requesteeId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("removed")),
  })
  .index("by_requestee_and_status", ["requesteeId", "status"])
  .index("by_requester_and_status", ["requesterId", "status"]) 
  .index("by_requester_and_requestee", ["requesterId", "requesteeId"]) 
  .index("by_requestee_and_requester", ["requesteeId", "requesterId"]), 

  blockedUsers: defineTable({
    blockerId: v.id("users"), 
    blockedId: v.id("users"), 
    reason: v.optional(v.string()), 
  })
  .index("by_blocker_and_blocked", ["blockerId", "blockedId"]) 
  .index("by_blocked_and_blocker", ["blockedId", "blockerId"]), 
  
  reports: defineTable({
    reporterId: v.id("users"),
    reportedUserId: v.id("users"),
    category: v.union(
        v.literal("violence"), 
        v.literal("bad_words"), 
        v.literal("match_absence"), 
        v.literal("spam"),
        v.literal("other")
    ),
    description: v.optional(v.string()),
    matchId: v.optional(v.id("matches")), // Optional: link report to a specific match
    status: v.union( // For admin/moderation tracking
        v.literal("pending_review"), 
        v.literal("resolved_no_action"), 
        v.literal("resolved_action_taken")
    ),
  })
  .index("by_reportedUserId_and_status", ["reportedUserId", "status"])
  .index("by_status", ["status"]), // For admins to list all pending reports

  notifications: defineTable({
    userId: v.id("users"), // Who receives the notification
    type: v.union(
      v.literal("friend_request_received"),
      v.literal("friend_request_accepted"),
      v.literal("friend_request_declined"),
      v.literal("party_invitation_received"),
      v.literal("party_invitation_accepted"),
      v.literal("party_invitation_declined")
    ),
    fromUserId: v.optional(v.id("users")), // Who triggered the notification
    friendRequestId: v.optional(v.id("friendRequests")), // Related friend request
    partyInvitationId: v.optional(v.id("partyInvitations")), // Related party invitation
    matchId: v.optional(v.id("matches")), // Related match for party invitations
    message: v.string(),
    isRead: v.boolean(),
  })
  .index("by_userId_and_isRead", ["userId", "isRead"])
  .index("by_userId", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
