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
    };
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
    };
  },
});

export const updateUserProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    favoritePosition: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    age: v.optional(v.number()),
    skillLevel: v.optional(v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
      v.literal("professional")
    )),
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
