import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

const FOOTBALL_POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;

// A temporary list of countries for the filter dropdown.
// In a real application, this might come from a dedicated API or a larger static list.
const COUNTRIES = ["USA", "Canada", "Mexico", "Brazil", "Argentina", "England", "France", "Germany", "Spain", "Italy", "Japan", "Nigeria", "Egypt", "Tunisia"];

const Button = ({ onClick, children, className = "", disabled = false, variant = "primary", type, size }: { onClick?: () => void; children: React.ReactNode; className?: string; disabled?: boolean; variant?: "primary" | "secondary" | "danger" | "ghost" | "accent"; type?: "button" | "submit" | "reset", size?: "sm" | "md" }) => {
  const baseStyle = "px-4 py-2 rounded font-semibold shadow-sm hover:shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
  }
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "bg-transparent text-primary hover:bg-primary/10",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  };
  return <button type={type} onClick={onClick} className={`${baseStyle} ${sizes[size ?? 'md']} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

interface LeaderboardProps {
  onNavigateToProfile: (userId: Id<"users">) => void;
}

export function Leaderboard({ onNavigateToProfile }: LeaderboardProps) {
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);

  const leaderboardData = useQuery(
    api.leaderboards.getOverallWorldwideLeaderboard,
    {
      position: positionFilter ?? undefined,
      country: countryFilter ?? undefined,
    }
  );

  return (
    <div className="p-4 bg-card text-card-foreground">
      <h2 className="text-3xl font-bold text-primary mb-6">Global Egoist Leaderboard</h2>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted rounded-lg">
        {/* Position Filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">Filter by Position</label>
          <select
            value={positionFilter ?? ""}
            onChange={(e) => setPositionFilter(e.target.value || null)}
            className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">All Positions</option>
            {FOOTBALL_POSITIONS.map(pos => (
              <option key={pos} value={pos} className="capitalize">{pos.charAt(0).toUpperCase() + pos.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Country Filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">Filter by Country</label>
          <select
            value={countryFilter ?? ""}
            onChange={(e) => setCountryFilter(e.target.value || null)}
            className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">Worldwide</option>
            {COUNTRIES.sort().map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto">
        {leaderboardData === undefined && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading Rankings...</p>
          </div>
        )}

        {leaderboardData && leaderboardData.length === 0 && (
          <div className="text-center py-8 bg-input rounded-lg">
            <p className="text-lg font-semibold text-card-foreground">No Egoists Found</p>
            <p className="text-muted-foreground mt-1">No players match the current filters. Try a different selection!</p>
          </div>
        )}

        {leaderboardData && leaderboardData.length > 0 && (
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Player</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Overall</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Ratings</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {leaderboardData.map((player, index) => (
                <tr key={player._id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap text-lg font-bold">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src={player.profileImageUrl ?? '/blue-lock-logo-placeholder.png'}
                        alt={player.displayName ?? 'Player'}
                        className="w-10 h-10 rounded-full object-cover mr-4 border-2 border-primary"
                      />
                      <span
                        className="font-medium text-text-blue-accent cursor-pointer hover:underline"
                        onClick={() => onNavigateToProfile(player.userId)}
                      >
                        {player.displayName ?? 'Egoist'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-lg font-semibold text-text-yellow-accent">
                    {player.overallScore?.toFixed(1) ?? 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">
                    {player.favoritePosition ?? 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {player.country ?? 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {player.ratingsCount ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
