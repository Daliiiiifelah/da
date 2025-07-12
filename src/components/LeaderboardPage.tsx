import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api'; // Adjusted path assuming components is one level down from src
import { Id } from '../../convex/_generated/dataModel';

interface LeaderboardPageProps {
  onNavigateToProfile: (userId: Id<"users">) => void;
}

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigateToProfile }) => {
  const leaderboardData = useQuery(api.leaderboards.getOverallWorldwideLeaderboard, { limit: 20 });

  if (leaderboardData === undefined) {
    return <div className="text-center py-8 text-muted-foreground">Loading leaderboard... <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-2"></div></div>;
  }

  if (leaderboardData === null) { // Should ideally not happen with current query, but good practice
    return <p className="text-destructive text-center">Could not load leaderboard data.</p>;
  }

  if (leaderboardData.length === 0) {
    return <p className="text-info text-center py-8">The leaderboard is currently empty. Play matches and get rated to appear here!</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-primary text-center mb-6">Top 20 Worldwide Egoists</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border bg-card rounded-lg shadow-md">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rank</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Player</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Overall Score</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Country</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Ratings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leaderboardData.map((player, index) => (
              <tr key={player.userId} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-card-foreground">#{index + 1}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className="flex items-center">
                    <img
                      className="h-8 w-8 rounded-full object-cover mr-3 border-2 border-primary/50"
                      src={player.profileImageUrl || '/blue-lock-logo-placeholder.png'}
                      alt={player.displayName || 'Player'}
                    />
                    <span
                      className="font-medium text-text-blue-accent hover:underline cursor-pointer"
                      onClick={() => onNavigateToProfile(player.userId)}
                    >
                      {player.displayName || player.uniqueUserId || 'Anonymous Egoist'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-text-yellow-accent">{player.overallScore?.toFixed(0) ?? 'N/A'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-card-foreground">{player.country || <span className="italic text-muted-foreground">N/A</span>}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{player.ratingsCount ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardPage;
