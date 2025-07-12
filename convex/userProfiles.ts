import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

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

export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getLoggedInUserOrThrow(ctx);
    
    // Check if user profile exists
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    return {
      ...user,
      displayName: profile?.displayName ?? null,
      bio: profile?.bio ?? null,
      profileImageUrl: profile?.profileImageUrl ?? null,
      location: profile?.location ?? null,
      age: profile?.age ?? null,
      skillLevel: profile?.skillLevel ?? null,
      favoritePosition: profile?.favoritePosition ?? null,
      uniqueUserId: profile?.uniqueUserId ?? null,
      // Hexagon Stats (6 core stats)
      speed: profile?.speed ?? null,
      // durability: profile?.durability ?? null, // Removed from core 6
      defense: profile?.defense ?? null,
      offense: profile?.offense ?? null,
      passing: profile?.passing ?? null,
      shooting: profile?.shooting ?? null,
      dribbling: profile?.dribbling ?? null,
      // Leaderboard fields
      country: profile?.country ?? null,
      overallScore: profile?.overallScore ?? null,
      ratingsCount: profile?.ratingsCount ?? 0, // Default to 0 if null
    };
  },
});

// Internal mutation to update aggregated stats for a user profile
export const updateAggregatedProfileStats = mutation({
  args: { ratedUserId: v.id("users") },
  handler: async (ctx, args) => {
    const allRatingsForUser = await ctx.db
      .query("playerRatings")
      .withIndex("by_ratedUser", (q) => q.eq("ratedUserId", args.ratedUserId))
      .collect();

    if (allRatingsForUser.length === 0) {
      // No ratings yet, perhaps set to a default or null? For now, do nothing or ensure defaults.
      // Or, ensure profile fields are just v.optional() and handle null in frontend.
      // Let's ensure it tries to update with nulls if no ratings, to clear out old values if any.
    }

    const gradeToValueMapping: Record<string, number> = {
      S: 95, // Mid-point of 90-100
      A: 85, // Mid-point of 80-89
      B: 75, // Mid-point of 70-79
      C: 65, // Mid-point of 60-69
      D: 55, // Mid-point of 50-59 (or adjust D's range, e.g. 0-59 -> ~30)
    };
    const MIN_RATINGS_FOR_AVERAGE = 1; // Minimum ratings before calculating an average

    const attributes: (keyof Doc<"playerRatings">)[] = [
      "speedGiven", "defenseGiven", "offenseGiven",
      "shootingGiven", "dribblingGiven", "passingGiven"
    ];

    const profileStatsUpdate: Partial<Doc<"userProfiles">> = {};

    for (const attributeGivenKey of attributes) {
      const profileStatKey = attributeGivenKey.replace("Given", "") as keyof Doc<"userProfiles">;

      const validRatingsForAttribute = allRatingsForUser
        .map(r => r[attributeGivenKey])
        .filter(grade => grade !== null && grade !== undefined && gradeToValueMapping[grade as string] !== undefined);

      if (validRatingsForAttribute.length >= MIN_RATINGS_FOR_AVERAGE) {
        const sumOfValues = validRatingsForAttribute.reduce((sum, grade) => sum + gradeToValueMapping[grade as string], 0);
        const averageValue = Math.round(sumOfValues / validRatingsForAttribute.length);
        profileStatsUpdate[profileStatKey] = averageValue;
      } else {
        profileStatsUpdate[profileStatKey] = null; // Set to null if not enough ratings
      }
    }

    // Ensure only the 6 core stats are being updated here, removing durability if it was in profileStatsUpdate
    delete (profileStatsUpdate as any).durability; // this line is actually not needed if durability is not in `attributes`

    // Calculate overallScore as the average of the 6 valid attribute scores
    let sumOfValidProfileStats = 0;
    let countOfValidProfileStats = 0;
    const coreStatKeys: (keyof Doc<"userProfiles">)[] = ["speed", "defense", "offense", "shooting", "dribbling", "passing"];

    coreStatKeys.forEach(key => {
      const value = profileStatsUpdate[key];
      if (typeof value === 'number') { // Check if it's a number (not null)
        sumOfValidProfileStats += value;
        countOfValidProfileStats++;
      }
    });

    if (countOfValidProfileStats > 0) {
      profileStatsUpdate.overallScore = Math.round(sumOfValidProfileStats / countOfValidProfileStats);
    } else {
      profileStatsUpdate.overallScore = null; // Or a default like 0 or 50
    }

    profileStatsUpdate.ratingsCount = allRatingsForUser.length;


    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.ratedUserId))
      .unique();

    if (userProfile) {
      // Include existing fields not being updated by this aggregation
      const finalUpdate = {
        ...profileStatsUpdate,
        // Ensure other fields like displayName, bio, etc. are not overwritten if not part of profileStatsUpdate
        // This is implicitly handled if profileStatsUpdate only contains stat fields.
        // However, to be safe, we could fetch existing profile and merge.
        // For now, this assumes profileStatsUpdate only has stat-related fields + overallScore + ratingsCount
      };
      await ctx.db.patch(userProfile._id, finalUpdate);
    } else {
      console.warn(`No userProfile found for ratedUserId: ${args.ratedUserId} during stat aggregation. Cannot update overallScore or ratingsCount.`);
      // If profile doesn't exist, we might not want to create it here,
      // as it should be created on user sign-up or first profile edit.
      // For now, just log and don't create.
    }

    return { success: true, updatedStats: profileStatsUpdate };
  },
});

export const getUserPublicProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      displayName: profile?.displayName ?? null,
      bio: profile?.bio ?? null,
      profileImageUrl: profile?.profileImageUrl ?? null,
      location: profile?.location ?? null,
      age: profile?.age ?? null,
      skillLevel: profile?.skillLevel ?? null,
      favoritePosition: profile?.favoritePosition ?? null,
      uniqueUserId: profile?.uniqueUserId ?? null,
      // Hexagon Stats (6 core stats)
      speed: profile?.speed ?? null,
      // durability: profile?.durability ?? null, // Removed from core 6
      defense: profile?.defense ?? null,
      offense: profile?.offense ?? null,
      passing: profile?.passing ?? null,
      shooting: profile?.shooting ?? null,
      dribbling: profile?.dribbling ?? null,
      // Leaderboard fields
      country: profile?.country ?? null,
      overallScore: profile?.overallScore ?? null,
      ratingsCount: profile?.ratingsCount ?? 0, // Default to 0 if null
    };
  },
});

export const updateUserProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    favoritePosition: v.optional(v.union(
      v.literal("goalkeeper"),
      v.literal("defender"),
      v.literal("midfielder"),
      v.literal("forward")
    )),
    profileImageUrl: v.optional(v.string()),
    location: v.optional(v.string()), // This is for general location text input
    age: v.optional(v.number()),
    skillLevel: v.optional(v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
      v.literal("professional")
    )),
    // Hexagon Stats
    speed: v.optional(v.number()),
    // durability: v.optional(v.number()), // Removed as per schema adjustment to 6 core stats
    defense: v.optional(v.number()),
    offense: v.optional(v.number()),
    passing: v.optional(v.number()),
    shooting: v.optional(v.number()),
    dribbling: v.optional(v.number()),
    country: v.optional(v.string()), // Added for leaderboard
  },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);

    // Check if display name is unique (case-insensitive)
    if (args.displayName) {
      const trimmedDisplayName = args.displayName.trim();
      if (trimmedDisplayName.length < 2) {
        throw new Error("Display name must be at least 2 characters long.");
      }
      if (trimmedDisplayName.length > 30) {
        throw new Error("Display name must be less than 30 characters.");
      }

      // Check for existing display name (case-insensitive)
      const existingProfile = await ctx.db
        .query("userProfiles")
        .filter((q) => q.neq(q.field("userId"), user._id))
        .collect();

      const displayNameTaken = existingProfile.some(profile => 
        profile.displayName?.toLowerCase() === trimmedDisplayName.toLowerCase()
      );

      if (displayNameTaken) {
        throw new Error("This display name is already taken. Please choose a different one.");
      }

      args.displayName = trimmedDisplayName;
    }

    // Validate age
    if (args.age !== undefined && (args.age < 13 || args.age > 100)) {
      throw new Error("Age must be between 13 and 100.");
    }

    // Validate Hexagon Stats (0-100)
    const statsToValidate: (keyof typeof args)[] = ["speed", "durability", "defense", "offense", "passing", "shooting", "dribbling"];
    for (const statName of statsToValidate) {
      const statValue = args[statName];
      if (statValue !== undefined) {
        if (typeof statValue !== 'number' || statValue < 0 || statValue > 100) {
          throw new Error(`${statName.charAt(0).toUpperCase() + statName.slice(1)} stat must be a number between 0 and 100.`);
        }
        // Optional: round to integer or specific decimal places if desired
        // args[statName] = Math.round(statValue);
      }
    }

    // Check if profile exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        ...args,
        updatedAt: Date.now(),
      });
    } else {
      // Create new profile
      await ctx.db.insert("userProfiles", {
        userId: user._id,
        ...args,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const searchUsers = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      return [];
    }

    const searchTerm = args.searchTerm.toLowerCase().trim();
    
    // Get all users and their profiles
    const allUsers = await ctx.db.query("users").collect();
    const allProfiles = await ctx.db.query("userProfiles").collect();
    
    // Create a map of userId to profile
    const profileMap = new Map();
    allProfiles.forEach(profile => {
      profileMap.set(profile.userId, profile);
    });

    // Filter users based on search term
    const filteredUsers = allUsers.filter(user => {
      const profile = profileMap.get(user._id);
      const displayName = profile?.displayName || user.name || user.email || "";
      const bio = profile?.bio || "";
      const location = profile?.location || "";
      
      return (
        displayName.toLowerCase().includes(searchTerm) ||
        bio.toLowerCase().includes(searchTerm) ||
        location.toLowerCase().includes(searchTerm) ||
        (user.email && user.email.toLowerCase().includes(searchTerm))
      );
    });

    // Return users with their profile data
    return filteredUsers.map(user => {
      const profile = profileMap.get(user._id);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        displayName: profile?.displayName,
        bio: profile?.bio,
        profileImageUrl: profile?.profileImageUrl,
        location: profile?.location,
        skillLevel: profile?.skillLevel,
        favoritePosition: profile?.favoritePosition,
        uniqueUserId: profile?.uniqueUserId,
      };
    }).slice(0, 20); // Limit to 20 results
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const generateProfilePictureUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveProfilePicture = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) throw new Error("Failed to get image URL");
    
    const existingProfile = await ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", user._id)).unique();
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, { profileImageUrl: imageUrl, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("userProfiles", { userId: user._id, profileImageUrl: imageUrl, createdAt: Date.now(), updatedAt: Date.now() });
    }
    return { success: true };
  },
});

export const updateBio = mutation({
  args: { bio: v.string() },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const existingProfile = await ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", user._id)).unique();
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, { bio: args.bio, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("userProfiles", { userId: user._id, bio: args.bio, createdAt: Date.now(), updatedAt: Date.now() });
    }
    return { success: true };
  },
});

export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const user = await getLoggedInUserOrThrow(ctx);
    const trimmedDisplayName = args.displayName.trim();
    if (trimmedDisplayName.length < 2) throw new Error("Display name must be at least 2 characters long.");
    
    const userProfile = await ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", user._id)).unique();
    if (userProfile) {
      await ctx.db.patch(userProfile._id, { displayName: trimmedDisplayName, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("userProfiles", { userId: user._id, displayName: trimmedDisplayName, createdAt: Date.now(), updatedAt: Date.now() });
    }
    return { success: true };
  },
});
