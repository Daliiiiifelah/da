import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
    import { v } from "convex/values";
    import { getAuthUserId } from "@convex-dev/auth/server";
    import { Doc, Id } from "./_generated/dataModel";

    async function getLoggedInUserOrThrow(ctx: QueryCtx | MutationCtx) {
      const userId = await getAuthUserId(ctx);
      if (!userId) throw new Error("User not authenticated.");
      const user = await ctx.db.get(userId);
      if (!user) throw new Error("Authenticated user record not found.");
      return { ...user, _id: userId };
    }

    export const reportCategories = v.union(
        v.literal("violence"), 
        v.literal("bad_words"), 
        v.literal("match_absence"), 
        v.literal("spam"),
        v.literal("other")
    );

    export const submitReport = mutation({
        args: {
            reportedUserId: v.id("users"),
            category: reportCategories,
            description: v.optional(v.string()),
            matchId: v.optional(v.id("matches")),
        },
        handler: async (ctx, args) => {
            const reporter = await getLoggedInUserOrThrow(ctx);

            if (reporter._id === args.reportedUserId) {
                throw new Error("You cannot report yourself.");
            }

            const reportedUser = await ctx.db.get(args.reportedUserId);
            if (!reportedUser) {
                throw new Error("The user you are trying to report does not exist.");
            }

            if (args.description && args.description.length > 1000) {
                throw new Error("Report description is too long (max 1000 characters).")
            }
            
            // Optional: Check if a similar report already exists recently to prevent spam
            // For now, allow multiple reports.

            await ctx.db.insert("reports", {
                reporterId: reporter._id,
                reportedUserId: args.reportedUserId,
                category: args.category,
                description: args.description,
                matchId: args.matchId,
                status: "pending_review",
            });

            return { success: true, message: "Report submitted successfully. Thank you for your feedback." };
        }
    });

    // Example of an internal query for admins (not used by client directly yet)
    export const internalListPendingReports = query({
        // Add access control here if this were to be exposed, e.g. check if user is admin
        handler: async (ctx) => {
            // const identity = await ctx.auth.getUserIdentity();
            // if(!identity || !identity.tokenIdentifier.endsWith("admin_user_suffix")) { // Example admin check
            //     throw new Error("Unauthorized to view reports");
            // }
            return await ctx.db.query("reports").withIndex("by_status", q => q.eq("status", "pending_review")).collect();
        }
    })
