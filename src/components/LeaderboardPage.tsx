import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// Define FOOTBALL_POSITIONS, ensure it matches schema and other usages
const FOOTBALL_POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;
type FootballPosition = typeof FOOTBALL_POSITIONS[number];

interface LeaderboardPageProps {
  onNavigateToProfile: (userId: Id<"users">) => void;
}

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigateToProfile }) => {
  const [selectedPosition, setSelectedPosition] = useState<FootballPosition | null>(null);

  const queryArgs = selectedPosition
    ? { limit: 20, position: selectedPosition }
    : { limit: 20 };
  const leaderboardData = useQuery(api.leaderboards.getOverallWorldwideLeaderboard, queryArgs);

  const handlePositionFilterChange = (position: FootballPosition | null) => {
    setSelectedPosition(position);
  };

  const getTitle = () => {
    if (!selectedPosition) return "Top 20 Overall Egoists Worldwide";
    return `Top 20 ${selectedPosition.charAt(0).toUpperCase() + selectedPosition.slice(1)}s Worldwide`;
  };

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
      <h2 className="text-2xl font-bold text-primary text-center mb-4">{getTitle()}</h2>

      <div className="mb-4 flex justify-center space-x-2 border-b border-border pb-2">
        <button
          onClick={() => handlePositionFilterChange(null)}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium
            ${selectedPosition === null ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
        >
          Overall
        </button>
        {FOOTBALL_POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => handlePositionFilterChange(pos)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium capitalize
              ${selectedPosition === pos ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
          >
            {pos}s {/* Pluralize, e.g., Goalkeepers */}
          </button>
        ))}
      </div>

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
