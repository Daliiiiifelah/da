import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { UserProfileModal } from "./UserProfileModal";
import { UserSearchModal } from "./UserSearchModal";
import { NotificationsModal } from "./NotificationsModal";
import { PartyChatModal } from "./PartyChatModal";
import { PartySearchModal } from "./PartySearchModal";
import { Leaderboard } from "./Leaderboard";
import { Toaster, toast } from "sonner";
import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { Doc, Id } from "../convex/_generated/dataModel";

const TEAMS = [
  { id: "A", name: "Team A", color: "Blue" },
  { id: "B", name: "Team B", color: "Red" }
] as const;

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.data?.message) return error.data.message;
  if (error?.data?.details) return error.data.details;
  if (error?.message) return error.message;
  return "An unexpected error occurred.";
}

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

const InputField = ({ label, type = "text", value, onChange, placeholder, required = false, className = "" }: { label?: string; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean; className?: string; }) => (
  <div className={`mb-4 ${className}`}>
    {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground" />
  </div>
);

const TextareaField = ({ label, value, onChange, placeholder, required = false, className = "" }: { label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; required?: boolean; className?: string; }) => (
  <div className={`mb-4 ${className}`}>
    {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={3} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground" />
  </div>
);

const Modal = ({ isOpen, onClose, title, children, size = "md", contentClassName = "" }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; contentClassName?: string; }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`bg-card shadow-xl w-full ${sizeClasses[size]} rounded-lg flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-xl font-semibold text-primary">{title}</h3>
          <Button onClick={onClose} variant="ghost" className="text-muted-foreground hover:text-card-foreground p-1 text-2xl">&times;</Button>
        </div>
        <div className={`p-4 overflow-y-auto ${contentClassName}`}>
         {children}
        </div>
      </div>
    </div>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card shadow-lg rounded-lg p-6 ${className}`}>
    {children}
  </div>
);

function CreateMatchForm({ onClose }: { onClose: () => void }) {
  // const [sport, setSport] = useState("Football"); // Removed for football-only focus
  const [location, setLocation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [playersNeeded, setPlayersNeeded] = useState(10);
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");
  const [locationAvailable, setLocationAvailable] = useState(true);

  // Venue Details State
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [pitchType, setPitchType] = useState(""); // Empty string for default "Select" option
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const createMatch = useMutation(api.matches.createMatch);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dateTime) {
      toast.error("Please select a date and time for the match.");
      return;
    }
    const matchDateTime = new Date(dateTime).getTime();
    if (matchDateTime <= Date.now()) {
      toast.error("Match date and time must be in the future.");
      return;
    }
    if (playersNeeded <= 0) {
      toast.error("Number of players must be greater than 0.");
      return;
    }

    try {
      await createMatch({
        // sport, // Removed for football-only focus
        location,
        dateTime: matchDateTime,
        playersNeeded: Number(playersNeeded),
        partyName: partyName.trim() === "" ? undefined : partyName.trim(),
        description: description.trim() === "" ? undefined : description.trim(),
        locationAvailable,
        venueName: venueName.trim() === "" ? undefined : venueName.trim(),
        address: address.trim() === "" ? undefined : address.trim(),
        pitchType: pitchType === "" ? undefined : pitchType as any, // Cast as any to satisfy specific literal union
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
      });
      toast.success("Match created successfully!");
      onClose();
    } catch (error: any) {
      toast.error(`Failed to create match: ${getErrorMessage(error)}`);
    }
  };

  // Generate valid player count options (6, 8, 10, 12, 14, 16, 18, 20, 22)
  const validPlayerCounts = [];
  for (let i = 6; i <= 22; i += 2) {
    validPlayerCounts.push(i);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* <InputField label="Sport" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g., Football, Basketball" required /> Removed for football-only focus */}
      <InputField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Local Park Pitch 1" required />
      <InputField label="Date and Time" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required 
        className="text-card-foreground [&::-webkit-calendar-picker-indicator]:bg-gray-400 [&::-webkit-calendar-picker-indicator]:rounded"
      />
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-foreground mb-1">Players Needed (Total - Team A vs Team B)</label>
        <select 
          value={playersNeeded} 
          onChange={(e) => setPlayersNeeded(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground"
          required
        >
          {validPlayerCounts.map(count => (
            <option key={count} value={count}>
              {count} players ({count/2} vs {count/2})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Each team will have {playersNeeded/2} players (1 goalkeeper + {(playersNeeded/2)-1} field players)
        </p>
      </div>

      <InputField label="Party Name (Optional)" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g., 'Elite Strikers', 'Weekend Warriors'" />

      {/* Venue Details Inputs */}
      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-lg font-medium text-text-accent mb-2">Venue Details (Optional)</h3>
        <InputField label="Venue Name" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g., Central Park - Pitch 2" />
        <TextareaField label="Address / Directions" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g., 123 Main St, near the big oak tree" />

        <div>
          <label htmlFor="pitchType" className="block text-sm font-medium text-muted-foreground mb-1">Pitch Type</label>
          <select
            id="pitchType"
            value={pitchType}
            onChange={(e) => setPitchType(e.target.value)}
            className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground"
          >
            <option value="">Select Pitch Type</option>
            <option value="grass">Grass</option>
            <option value="artificial_turf">Artificial Turf</option>
            <option value="indoor_court">Indoor Court</option>
            <option value="dirt">Dirt</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-muted-foreground mb-1">Amenities</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {["Parking", "Restrooms", "Lights", "Water Fountain", "Covered Area", "Benches"].map(amenity => (
              <label key={amenity} className="flex items-center space-x-2 p-2 rounded-md bg-input border border-border hover:bg-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAmenities(prev => [...prev, amenity]);
                    } else {
                      setSelectedAmenities(prev => prev.filter(a => a !== amenity));
                    }
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
                <span className="text-sm text-card-foreground">{amenity}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <TextareaField label="Description (Optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any extra details, e.g., 'Bring water!'" />
      <div className="flex items-center">
        <input type="checkbox" id="locationAvailable" checked={locationAvailable} onChange={(e) => setLocationAvailable(e.target.checked)} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-border rounded" />
        <label htmlFor="locationAvailable" className="text-sm text-muted-foreground">Location is confirmed/available</label>
      </div>
      <Button type="submit" className="w-full">Create Team Match</Button>
    </form>
  );
}

const FOOTBALL_POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;
const RATING_ATTRIBUTES = ["speed", "defense", "offense", "shooting", "dribbling", "passing"] as const;
type RatingAttribute = typeof RATING_ATTRIBUTES[number];
type Grade = "S" | "A" | "B" | "C" | "D";

interface AttributeRatingsInput {
  suggestion?: string;
  speedGiven?: Grade | "";
  defenseGiven?: Grade | "";
  offenseGiven?: Grade | "";
  shootingGiven?: Grade | "";
  dribblingGiven?: Grade | "";
  passingGiven?: Grade | "";
}

function RatePlayersModal({ isOpen, onClose, matchId, currentUserId }: { isOpen: boolean; onClose: () => void; matchId: Id<"matches">; currentUserId: Id<"users"> | null }) {
  const playersToRateData = useQuery(api.ratings.getPlayersToRate, matchId ? { matchId } : "skip");
  const submitRatingMutation = useMutation(api.ratings.submitRating);
  const [ratings, setRatings] = useState<Record<Id<"users">, AttributeRatingsInput>>({});

  useEffect(() => {
    if (playersToRateData) {
      const initialRatings: Record<Id<"users">, AttributeRatingsInput> = {};
      playersToRateData.forEach(player => {
        if (!player.alreadyRated) {
          initialRatings[player.userId] = {
            suggestion: "",
            speedGiven: "",
            defenseGiven: "",
            offenseGiven: "",
            shootingGiven: "",
            dribblingGiven: "",
            passingGiven: ""
          };
        }
      });
      setRatings(initialRatings);
    }
  }, [playersToRateData]);

  const handleAttributeGradeChange = (ratedUserId: Id<"users">, attributeName: `${RatingAttribute}Given`, grade: Grade) => {
    setRatings(prev => ({
      ...prev,
      [ratedUserId]: {
        ...prev[ratedUserId],
        [attributeName]: grade,
      },
    }));
  };

  const handleSuggestionChange = (ratedUserId: Id<"users">, suggestion: string) => {
    setRatings(prev => ({
      ...prev,
      [ratedUserId]: { ...prev[ratedUserId], suggestion },
    }));
  };

  const handleSubmitRatings = async () => {
    if (!currentUserId) {
      toast.error("You must be logged in to submit ratings.");
      return;
    }
    let allSubmittedSuccessfully = true;
    let submittedCount = 0;
    for (const rUserId in ratings) {
      const ratedUserId = rUserId as Id<"users">;
      const rating = ratings[ratedUserId];

      // Check if any attribute is rated or if a suggestion is provided
      const isAnyAttributeRated = RATING_ATTRIBUTES.some(attr => !!rating[`${attr}Given` as keyof AttributeRatingsInput]);
      const hasSuggestion = rating.suggestion && rating.suggestion.trim() !== "";

      if (isAnyAttributeRated || hasSuggestion) {
        try {
          // Prepare payload, ensuring only set grades are sent
          const payload: any = {
            matchId,
            ratedUserId,
            suggestion: rating.suggestion,
          };
          RATING_ATTRIBUTES.forEach(attr => {
            const attributeKey = `${attr}Given` as keyof AttributeRatingsInput;
            if (rating[attributeKey]) {
              payload[attributeKey] = rating[attributeKey];
            }
          });

          await submitRatingMutation(payload);
          submittedCount++;
        } catch (error) {
          allSubmittedSuccessfully = false;
          toast.error(`Failed to submit rating for ${playersToRateData?.find(p=>p.userId === ratedUserId)?.name || 'Egoist'}: ${getErrorMessage(error)}`);
        }
      }
    }
    if (submittedCount > 0 && allSubmittedSuccessfully) {
      toast.success("Ratings submitted successfully!");
    } else if (submittedCount === 0 && Object.values(ratings).some(r => r.stars > 0)) {
    } else if (submittedCount === 0) {
      toast.info("No new ratings were submitted.");
    }
    if (allSubmittedSuccessfully || submittedCount > 0) { 
        onClose();
    }
  };
  
  const unratedPlayers = playersToRateData?.filter(p => !p.alreadyRated && ratings[p.userId]) || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rate Fellow Egoists" size="xl" contentClassName="flex-grow">
      {playersToRateData === undefined && <p className="text-muted-foreground">Loading Egoists...</p>}
      {playersToRateData && playersToRateData.length === 0 && <p className="text-info">No other Egoists participated in this match to rate.</p>}
      {playersToRateData && playersToRateData.length > 0 && unratedPlayers.length === 0 && <p className="text-info">All eligible Egoists have been rated for this match.</p>}
      
      {playersToRateData && unratedPlayers.length > 0 && (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {unratedPlayers.map((player) => (
            <div key={player.userId} className="p-4 border border-border rounded-md shadow-sm bg-input">
              <h4 className="font-semibold text-lg text-primary mb-3">{player.name} <span className="text-sm text-muted-foreground">({player.position})</span></h4>

              <div className="space-y-3">
                {RATING_ATTRIBUTES.map(attr => {
                  const attributeKey = `${attr}Given` as keyof AttributeRatingsInput;
                  const currentGrade = ratings[player.userId]?.[attributeKey];
                  return (
                    <div key={attr}>
                      <p className="text-sm mb-1 text-muted-foreground capitalize">{attr}:</p>
                      <div className="flex space-x-1">
                        {(["S", "A", "B", "C", "D"] as Grade[]).map(grade => (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => handleAttributeGradeChange(player.userId, attributeKey, grade)}
                            className={`w-8 h-8 rounded-md border text-sm font-semibold transition-all hover:opacity-90
                              ${currentGrade === grade
                                ? (grade === "S" ? "bg-yellow-400 border-yellow-600 text-yellow-900 ring-2 ring-yellow-500" :
                                   grade === "A" ? "bg-green-400 border-green-600 text-green-900 ring-2 ring-green-500" :
                                   grade === "B" ? "bg-blue-400 border-blue-600 text-blue-900 ring-2 ring-blue-500" :
                                   grade === "C" ? "bg-orange-400 border-orange-600 text-orange-900 ring-2 ring-orange-500" :
                                   "bg-red-400 border-red-600 text-red-900 ring-2 ring-red-500") // D
                                : "bg-secondary border-border hover:bg-secondary/80"
                              }`}
                          >
                            {grade}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <TextareaField
                className="mt-4"
                label="Constructive Feedback (Optional):"
                value={ratings[player.userId]?.suggestion || ""}
                onChange={(e) => handleSuggestionChange(player.userId, e.target.value)}
                placeholder="Help this Egoist sharpen their skills!"
              />
            </div>
          ))}
          <Button
            onClick={handleSubmitRatings}
            className="w-full mt-4"
            disabled={Object.values(ratings).every(r =>
              !RATING_ATTRIBUTES.some(attr => !!r[`${attr}Given` as keyof AttributeRatingsInput]) &&
              (!r.suggestion || r.suggestion.trim() === "")
            )}
          >
            Submit All Ratings
          </Button>
        </div>
      )}
    </Modal>
  );
}

function MatchCard({ match, currentUserId, onUserClick }: { match: Doc<"matches"> & { participantCount: number, participants: (Doc<"participants"> & {userName?: string})[] } ; currentUserId: Id<"users"> | null; onUserClick: (userId: Id<"users">) => void; }) {
  const joinMatch = useMutation(api.matches.joinMatch);
  const creatorJoinMatch = useMutation(api.matches.creatorJoinMatch);
  const leaveMatch = useMutation(api.matches.leaveMatch);
  const cancelMatch = useMutation(api.matches.cancelMatch);
  const completeMatch = useMutation(api.matches.completeMatch);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreatorJoinModal, setShowCreatorJoinModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<"A" | "B">("A");
  const [selectedPosition, setSelectedPosition] = useState<"goalkeeper" | "defender" | "midfielder" | "forward">("defender");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRatePlayersModal, setShowRatePlayersModal] = useState(false);
  const [showPartyChatModal, setShowPartyChatModal] = useState(false);
  
  const matchDetails = useQuery(api.matches.getMatchDetails, (showJoinModal || showCreatorJoinModal || showDetailsModal || showRatePlayersModal || showPartyChatModal) && match?._id ? { matchId: match._id } : "skip");
  const creatorProfile = useQuery(api.userProfiles.getUserPublicProfile, match ? { userId: match.creatorId } : "skip");

  const handleJoin = async () => {
    try {
      await joinMatch({ matchId: match._id, team: selectedTeam, position: selectedPosition });
      toast.success("Successfully joined match!");
      setShowJoinModal(false); setSelectedTeam("A"); setSelectedPosition("defender");
    } catch (error: any) { toast.error(`Failed to join match: ${getErrorMessage(error)}`); }
  };

  const handleCreatorJoin = async () => {
    try {
      await creatorJoinMatch({ matchId: match._id, team: selectedTeam, position: selectedPosition });
      toast.success("Successfully joined your match as a player!");
      setShowCreatorJoinModal(false); setSelectedTeam("A"); setSelectedPosition("defender");
    } catch (error: any) { toast.error(`Failed to join match: ${getErrorMessage(error)}`); }
  };

  const handleLeave = async () => {
    try {
      await leaveMatch({ matchId: match._id });
      toast.success("Successfully left match!");
    } catch (error: any) { toast.error(`Failed to leave match: ${getErrorMessage(error)}`); }
  };
  
  const handleCancel = async () => {
    if(window.confirm("Are you sure you want to cancel this match? This cannot be undone.")){
      try {
        await cancelMatch({ matchId: match._id });
        toast.success("Match cancelled.");
      } catch (error: any) { toast.error(`Failed to cancel match: ${getErrorMessage(error)}`); }
    }
  };

  const handleComplete = async () => {
     if(window.confirm("Are you sure you want to mark this match as completed?")){
      try {
        await completeMatch({ matchId: match._id });
        toast.success("Match marked as completed.");
      } catch (error: any) { toast.error(`Failed to complete match: ${getErrorMessage(error)}`); }
    }
  };

  const isParticipant = match.participants?.some((p: any) => p.userId === currentUserId);
  const isCreator = match.creatorId === currentUserId;
  const isFull = match.participantCount >= match.playersNeeded;

  if (!match) return null;

  // Calculate team compositions for display
  const teamAParticipants = matchDetails?.participants?.filter(p => p.team === "A") || [];
  const teamBParticipants = matchDetails?.participants?.filter(p => p.team === "B") || [];
  const maxPerTeam = match.playersNeeded / 2;

  return (
    <Card className="mb-6 flex flex-col border border-border">
      <div className="flex-grow">
        <div className="flex items-center mb-3">
          <img 
            src={creatorProfile?.profileImageUrl ?? "/blue-lock-logo-placeholder.png"} 
            alt={creatorProfile?.name ?? "Creator"} 
            className="w-10 h-10 rounded-full mr-3 object-cover border-2 border-primary cursor-pointer"
            onClick={() => onUserClick(match.creatorId)}
          />
          <div>
            <h3 className="text-2xl font-bold text-primary">{match.partyName || "Football Match"}</h3>
            <p className="text-xs text-muted-foreground">Hosted by <span className="text-text-blue-accent cursor-pointer hover:underline" onClick={() => onUserClick(match.creatorId)}>{creatorProfile?.name ?? "An Egoist"}</span></p>
          </div>
        </div>
        {/* <p className="text-card-foreground"><span className="font-semibold text-text-cyan-accent">Sport:</span> {match.sport}</p> Removed for football-only focus */}
        <p className="text-card-foreground">
          <span className="font-semibold text-text-cyan-accent">Where:</span> {match.venueName ? `${match.venueName} (${match.location})` : match.location}
        </p>
        <p className="text-card-foreground"><span className="font-semibold text-text-cyan-accent">When:</span> {new Date(match.dateTime).toLocaleString()}</p>
        
        {/* Team composition display */}
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="font-semibold text-blue-400">Team A (Blue)</p>
            <p className="text-sm text-muted-foreground">{teamAParticipants.length}/{maxPerTeam} players</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-red-400">Team B (Red)</p>
            <p className="text-sm text-muted-foreground">{teamBParticipants.length}/{maxPerTeam} players</p>
          </div>
        </div>
        
        <p className="text-card-foreground mt-2"><span className="font-semibold text-text-cyan-accent">Total Spots:</span> <span className="text-text-yellow-accent">{match.playersNeeded - match.participantCount}</span> remaining (out of {match.playersNeeded})</p>
        {match.description && <p className="text-muted-foreground mt-1 text-sm"><span className="font-semibold text-text-cyan-accent">Details:</span> {match.description}</p>}
        <p className={`text-sm mt-1 ${match.locationAvailable ? 'text-success' : 'text-warning'}`}>
          {match.locationAvailable ? "Location Confirmed" : "Location Tentative"}
        </p>
         <p className={`text-sm mt-1 font-semibold ${
            match.status === 'open' ? 'text-success' : 
            match.status === 'full' ? 'text-info' : 
            match.status === 'cancelled' ? 'text-destructive' : 
            match.status === 'completed' ? 'text-muted-foreground' : 'text-warning'
          }`}>
          Status: {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-border">
        {!isCreator && match.status === "open" && !isParticipant && !isFull && (
          <Button onClick={() => setShowJoinModal(true)} variant="accent">Join Team Match</Button>
        )}
        {!isCreator && match.status === "open" && !isParticipant && isFull && (
          <Button disabled>Match Full</Button>
        )}
        {isCreator && match.status === "open" && !isParticipant && !isFull && (
          <Button onClick={() => setShowCreatorJoinModal(true)} variant="primary">Join as Player</Button>
        )}
        {isCreator && match.status === "open" && !isParticipant && isFull && (
          <Button disabled>Match Full</Button>
        )}
        {(isCreator || !isCreator) && isParticipant && (match.status === "open" || match.status === "full") && (
          <Button onClick={handleLeave} variant="secondary">Leave Match</Button>
        )}
         <Button onClick={() => setShowDetailsModal(true)} variant="ghost">View Details</Button>
        {(isCreator || isParticipant) && (match.status === "open" || match.status === "full") && (
             <Button onClick={() => setShowPartyChatModal(true)} variant="ghost" className="text-text-purple-accent">Party Chat</Button>
        )}
        {isCreator && (match.status === "open" || match.status === "full") && (
          <>
            <Button onClick={handleCancel} variant="danger">Cancel Match</Button>
            <Button onClick={handleComplete} variant="secondary">Mark Completed</Button>
          </>
        )}
        {match.status === "completed" && (isParticipant || isCreator) && currentUserId && (
          <Button onClick={() => setShowRatePlayersModal(true)} variant="primary">Rate Egoists</Button>
        )}
      </div>

      {/* Regular Join Modal */}
      <Modal isOpen={showJoinModal} onClose={() => {setShowJoinModal(false); setSelectedTeam("A"); setSelectedPosition("defender");}} title={`Join Team Match: ${match.partyName || "Football Match"}`} size="lg" contentClassName="flex-grow">
        {matchDetails === undefined && <div className="text-center py-4 text-muted-foreground">Loading match details... <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-2"></div></div>}
        {matchDetails === null && <p className="text-destructive">Error: Could not load match details.</p>}
        {matchDetails && (
          <div>
            <img src="/stadium-placeholder.jpg" alt="Stadium" className="w-full h-48 object-cover rounded-md mb-4"/>
            <p className="mb-1 text-lg text-card-foreground"><strong>Football</strong> at <strong>{match.location}</strong></p> {/* Sport hardcoded to Football */}
            <p className="mb-4 text-sm text-muted-foreground">Choose your team and position. Each team needs {maxPerTeam} players (1 goalkeeper + {maxPerTeam-1} field players).</p>
            
            {/* Team Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-card-foreground mb-3">Select Team</h4>
              <div className="grid grid-cols-2 gap-3">
                {TEAMS.map(team => {
                  const teamParticipants = matchDetails.participants?.filter(p => p.team === team.id) || [];
                  const isFull = teamParticipants.length >= maxPerTeam;
                  const isSelected = selectedTeam === team.id;
                  
                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team.id)}
                      disabled={isFull}
                      className={`p-4 border rounded-md text-center transition-all ${
                        isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary/70' : 'bg-input hover:bg-muted border-border text-card-foreground'
                      } ${isFull ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : 'hover:shadow-md'}`}
                    >
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-sm text-muted-foreground">({team.color})</div>
                      <div className="text-xs mt-1">{teamParticipants.length}/{maxPerTeam} players</div>
                      {isFull && <div className="text-xs text-destructive">Full</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Position Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-card-foreground mb-3">Select Position</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {FOOTBALL_POSITIONS.map(pos => {
                  const selectedTeamParticipants = matchDetails.participants?.filter(p => p.team === selectedTeam) || [];
                  const goalkeepers = selectedTeamParticipants.filter(p => p.position === "goalkeeper");
                  const positionTaken = pos === "goalkeeper" ? goalkeepers.length >= 1 : false;
                  
                  // Calculate field position limits
                  const maxFieldPlayersPerTeam = maxPerTeam - 1; // Subtract goalkeeper
                  const maxPerFieldPosition = Math.ceil(maxFieldPlayersPerTeam / 3);
                  const positionCount = selectedTeamParticipants.filter(p => p.position === pos).length;
                  const fieldPositionFull = pos !== "goalkeeper" && positionCount >= maxPerFieldPosition;
                  
                  const isDisabled = positionTaken || fieldPositionFull;
                  const isSelected = selectedPosition === pos;
                  
                  return (
                    <button 
                      key={pos} 
                      onClick={() => setSelectedPosition(pos)} 
                      disabled={isDisabled && !isSelected} 
                      className={`p-3 border rounded-md text-center transition-all ${
                        isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary/70' : 'bg-input hover:bg-muted border-border text-card-foreground'
                      } ${isDisabled ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : 'hover:shadow-md'}`}
                    >
                      <div className="font-medium">{pos.charAt(0).toUpperCase() + pos.slice(1)}</div>
                      {pos === "goalkeeper" ? (
                        <div className="text-xs mt-1">{goalkeepers.length}/1</div>
                      ) : (
                        <div className="text-xs mt-1">{positionCount}/{maxPerFieldPosition}</div>
                      )}
                      {isDisabled && <div className="text-xs text-destructive">Full</div>}
                    </button>
                  );
                })}
              </div>
              {selectedPosition && <p className="text-center mb-3 text-primary font-semibold">You selected: {selectedPosition} for Team {selectedTeam}</p>}
              <Button onClick={handleJoin} className="w-full mt-2" type="button" disabled={!selectedPosition || (matchDetails.participantCount >= matchDetails.playersNeeded)}>
                {matchDetails.participantCount >= matchDetails.playersNeeded ? "Match is Full" : "Confirm & Join Team"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Creator Join Modal */}
      <Modal isOpen={showCreatorJoinModal} onClose={() => {setShowCreatorJoinModal(false); setSelectedTeam("A"); setSelectedPosition("defender");}} title={`Join Your Match as Player: ${match.partyName || "Football Match"}`} size="lg" contentClassName="flex-grow">
        {matchDetails === undefined && <div className="text-center py-4 text-muted-foreground">Loading match details... <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-2"></div></div>}
        {matchDetails === null && <p className="text-destructive">Error: Could not load match details.</p>}
        {matchDetails && (
          <div>
            <img src="/stadium-placeholder.jpg" alt="Stadium" className="w-full h-48 object-cover rounded-md mb-4"/>
            <p className="mb-1 text-lg text-card-foreground"><strong>Football</strong> at <strong>{match.location}</strong></p> {/* Sport hardcoded to Football */}
            <p className="mb-4 text-sm text-muted-foreground">As the party creator, you can join your own match as a player. Choose your team and position. Each team needs {maxPerTeam} players (1 goalkeeper + {maxPerTeam-1} field players).</p>
            
            {/* Team Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-card-foreground mb-3">Select Team</h4>
              <div className="grid grid-cols-2 gap-3">
                {TEAMS.map(team => {
                  const teamParticipants = matchDetails.participants?.filter(p => p.team === team.id) || [];
                  const isFull = teamParticipants.length >= maxPerTeam;
                  const isSelected = selectedTeam === team.id;
                  
                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team.id)}
                      disabled={isFull}
                      className={`p-4 border rounded-md text-center transition-all ${
                        isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary/70' : 'bg-input hover:bg-muted border-border text-card-foreground'
                      } ${isFull ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : 'hover:shadow-md'}`}
                    >
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-sm text-muted-foreground">({team.color})</div>
                      <div className="text-xs mt-1">{teamParticipants.length}/{maxPerTeam} players</div>
                      {isFull && <div className="text-xs text-destructive">Full</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Position Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-card-foreground mb-3">Select Position</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {FOOTBALL_POSITIONS.map(pos => {
                  const selectedTeamParticipants = matchDetails.participants?.filter(p => p.team === selectedTeam) || [];
                  const goalkeepers = selectedTeamParticipants.filter(p => p.position === "goalkeeper");
                  const positionTaken = pos === "goalkeeper" ? goalkeepers.length >= 1 : false;
                  
                  // Calculate field position limits
                  const maxFieldPlayersPerTeam = maxPerTeam - 1; // Subtract goalkeeper
                  const maxPerFieldPosition = Math.ceil(maxFieldPlayersPerTeam / 3);
                  const positionCount = selectedTeamParticipants.filter(p => p.position === pos).length;
                  const fieldPositionFull = pos !== "goalkeeper" && positionCount >= maxPerFieldPosition;
                  
                  const isDisabled = positionTaken || fieldPositionFull;
                  const isSelected = selectedPosition === pos;
                  
                  return (
                    <button 
                      key={pos} 
                      onClick={() => setSelectedPosition(pos)} 
                      disabled={isDisabled && !isSelected} 
                      className={`p-3 border rounded-md text-center transition-all ${
                        isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary/70' : 'bg-input hover:bg-muted border-border text-card-foreground'
                      } ${isDisabled ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : 'hover:shadow-md'}`}
                    >
                      <div className="font-medium">{pos.charAt(0).toUpperCase() + pos.slice(1)}</div>
                      {pos === "goalkeeper" ? (
                        <div className="text-xs mt-1">{goalkeepers.length}/1</div>
                      ) : (
                        <div className="text-xs mt-1">{positionCount}/{maxPerFieldPosition}</div>
                      )}
                      {isDisabled && <div className="text-xs text-destructive">Full</div>}
                    </button>
                  );
                })}
              </div>
              {selectedPosition && <p className="text-center mb-3 text-primary font-semibold">You selected: {selectedPosition} for Team {selectedTeam}</p>}
              <Button onClick={handleCreatorJoin} className="w-full mt-2" type="button" disabled={!selectedPosition || (matchDetails.participantCount >= matchDetails.playersNeeded)}>
                {matchDetails.participantCount >= matchDetails.playersNeeded ? "Match is Full" : "Join as Player"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Team Match Details: ${match.partyName || "Football Match"}`} size="lg" contentClassName="flex-grow">
        {matchDetails === undefined && <p className="text-muted-foreground">Loading details...</p>}
        {matchDetails === null && <p className="text-destructive">Match not found.</p>}
        {matchDetails && (
          <div>
            <div className="flex items-center mb-3">
                <img src={creatorProfile?.profileImageUrl ?? "/blue-lock-logo-placeholder.png"} alt={creatorProfile?.name ?? "Creator"} 
                    className="w-12 h-12 rounded-full mr-3 object-cover border-2 border-primary cursor-pointer" onClick={() => onUserClick(match.creatorId)} />
                <div>
                    <p className="font-semibold text-card-foreground">Hosted by <span className="text-text-blue-accent cursor-pointer hover:underline" onClick={() => onUserClick(match.creatorId)}>{matchDetails.creatorName}</span></p>
                </div>
            </div>
            {/* <p className="text-card-foreground"><strong>Sport:</strong> {matchDetails.sport}</p> Removed for football-only focus */}
            <p className="text-card-foreground"><strong>General Location:</strong> {matchDetails.location}</p>
            {matchDetails.venueName && <p className="text-card-foreground"><strong>Venue:</strong> {matchDetails.venueName}</p>}
            {matchDetails.address && <p className="text-card-foreground"><strong>Address:</strong> {matchDetails.address}</p>}
            <p className="text-card-foreground"><strong>Date:</strong> {new Date(matchDetails.dateTime).toLocaleString()}</p>
            <p className="text-card-foreground"><strong>Format:</strong> {maxPerTeam} vs {maxPerTeam} (Team A vs Team B)</p>
            <p className="text-card-foreground"><strong>Egoists:</strong> <span className="text-text-yellow-accent">{matchDetails.participantCount}</span> / {matchDetails.playersNeeded}</p>
            <p className="text-card-foreground"><strong>Status:</strong> <span className={ matchDetails.status === 'open' ? 'text-success' : matchDetails.status === 'full' ? 'text-info' : matchDetails.status === 'cancelled' ? 'text-destructive' : matchDetails.status === 'completed' ? 'text-muted-foreground' : 'text-warning'}>{matchDetails.status.charAt(0).toUpperCase() + matchDetails.status.slice(1)}</span></p>
            {matchDetails.pitchType && <p className="text-card-foreground capitalize"><strong>Pitch Type:</strong> {matchDetails.pitchType.replace("_", " ")}</p>}
            {matchDetails.amenities && matchDetails.amenities.length > 0 && (
              <div>
                <p className="text-card-foreground font-semibold">Amenities:</p>
                <ul className="list-disc list-inside pl-2 text-sm text-muted-foreground">
                  {matchDetails.amenities.map((amenity: string) => <li key={amenity}>{amenity}</li>)}
                </ul>
              </div>
            )}
            {matchDetails.description && <p className="text-card-foreground mt-2"><strong>Description:</strong> {matchDetails.description}</p>}
            
            {/* Team compositions */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-lg text-blue-400 mb-3">Team A (Blue) - {teamAParticipants.length}/{maxPerTeam}</h4>
                {teamAParticipants.length > 0 ? (
                  <ul className="list-none pl-0 space-y-2">
                    {teamAParticipants.map((p: any) => ( 
                      <ParticipantItem key={p.userId} userId={p.userId} initialName={p.userName} position={p.position} onUserClick={onUserClick} team="A" /> 
                    ))}
                  </ul>
                ) : ( 
                  <p className="text-muted-foreground">No players yet</p> 
                )}
              </div>
              
              <div>
                <h4 className="font-semibold text-lg text-red-400 mb-3">Team B (Red) - {teamBParticipants.length}/{maxPerTeam}</h4>
                {teamBParticipants.length > 0 ? (
                  <ul className="list-none pl-0 space-y-2">
                    {teamBParticipants.map((p: any) => ( 
                      <ParticipantItem key={p.userId} userId={p.userId} initialName={p.userName} position={p.position} onUserClick={onUserClick} team="B" /> 
                    ))}
                  </ul>
                ) : ( 
                  <p className="text-muted-foreground">No players yet</p> 
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      {currentUserId && <RatePlayersModal isOpen={showRatePlayersModal} onClose={() => setShowRatePlayersModal(false)} matchId={match._id} currentUserId={currentUserId} />}
       {currentUserId && (match.status === "open" || match.status === "full") && <PartyChatModal isOpen={showPartyChatModal} onClose={() => setShowPartyChatModal(false)} matchId={match._id} matchName={match.partyName || "Football Match"} />}
    </Card>
  );
}

function ParticipantItem({ userId, initialName, position, onUserClick, team }: { userId: Id<"users">, initialName: string, position: string, onUserClick: (userId: Id<"users">) => void; team?: "A" | "B" }) {
  const userPublicProfile = useQuery(api.userProfiles.getUserPublicProfile, { userId });
  // const averageRating = useQuery(api.ratings.getPlayerAverageRating, { userId }); // Removed
  const displayName = userPublicProfile?.displayName ?? userPublicProfile?.name ?? initialName;
  const displayImage = userPublicProfile?.profileImageUrl;

  const teamColor = team === "A" ? "border-blue-400" : team === "B" ? "border-red-400" : "border-primary";

  return (
    <li className="flex items-center space-x-3 py-2 border-b border-border last:border-b-0">
      <img src={displayImage ?? "/blue-lock-logo-placeholder.png"} alt={displayName}
        className={`w-10 h-10 rounded-full object-cover border-2 cursor-pointer ${teamColor}`} onClick={() => onUserClick(userId)} />
      <div>
        <span className="font-medium text-text-blue-accent cursor-pointer hover:underline" onClick={() => onUserClick(userId)}>{displayName}</span> 
        <span className="text-sm text-muted-foreground">({position})</span>
        {/* Average rating display removed, overallScore from userPublicProfile can be used if needed elsewhere */}
      </div>
    </li>
  );
}

function MatchList({ currentUserId, onUserClick, onCreateMatchClick }: { currentUserId: Id<"users"> | null; onUserClick: (userId: Id<"users">) => void; onCreateMatchClick: () => void; }) {
  const [skillLevelFilter, setSkillLevelFilter] = useState<string | null>(null);

  const openMatchesData = useQuery(
    api.matches.listOpenMatches,
    skillLevelFilter ? { filterSkillLevel: skillLevelFilter as any } : {}
  );

  if (openMatchesData === undefined) {
    return <div className="text-center py-8 text-muted-foreground">Loading matches... <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-2"></div></div>;
  }
  const openMatches = openMatchesData || [];
  const skillLevels = ["beginner", "intermediate", "advanced"];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-primary">Open Team Matches for Egoists</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-muted-foreground">Filter by Skill:</span>
          <Button
            onClick={() => setSkillLevelFilter(null)}
            variant={!skillLevelFilter ? "primary" : "secondary"}
            size="sm"
          >
            All
          </Button>
          {skillLevels.map(level => (
            <Button
              key={level}
              onClick={() => setSkillLevelFilter(level)}
              variant={skillLevelFilter === level ? "primary" : "secondary"}
              size="sm"
              className="capitalize"
            >
              {level}
            </Button>
          ))}
        </div>
      </div>

      {openMatches.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No open matches currently match your filter. Why not <span className="text-accent cursor-pointer hover:underline" onClick={onCreateMatchClick}>create one</span>, Egoist?</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {openMatches.map((match) => ( <MatchCard key={match._id} match={match} currentUserId={currentUserId} onUserClick={onUserClick} /> ))}
        </div>
      )}
    </div>
  );
}

function MyMatchesDashboard({ currentUserId, onUserClick }: { currentUserId: Id<"users"> | null; onUserClick: (userId: Id<"users">) => void; }) {
  const myCreatedMatchesData = useQuery(api.matches.getMyCreatedMatches);
  const myJoinedMatchesData = useQuery(api.matches.getMyJoinedMatches);
  if (!currentUserId) return null;
  const myCreatedMatches = myCreatedMatchesData || [];
  const myJoinedMatches = myJoinedMatchesData || [];
  if (myCreatedMatchesData === undefined || myJoinedMatchesData === undefined) {
     return <div className="text-center py-8 mt-12 text-muted-foreground">Loading your matches... <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-2"></div></div>;
  }
  return (
    <div className="mt-12">
      <h2 className="text-3xl font-bold text-primary mb-6">My Egoist Dashboard</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-2xl font-semibold text-text-cyan-accent mb-4">Team Matches I've Created</h3>
          {myCreatedMatches.length === 0 ? ( <p className="text-muted-foreground">You haven't created any matches yet.</p> ) : (
            myCreatedMatches.map(match => <MatchCard key={match._id} match={match as any} currentUserId={currentUserId} onUserClick={onUserClick} />)
          )}
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-text-green-accent mb-4">Team Matches I've Joined</h3>
          {myJoinedMatches.length === 0 ? ( <p className="text-muted-foreground">You haven't joined any matches yet.</p> ) : (
            myJoinedMatches.map(match => <MatchCard key={match._id} match={match as any} currentUserId={currentUserId} onUserClick={onUserClick} />)
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<Id<"users"> | null>(null);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPartySearchModal, setShowPartySearchModal] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState("");
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false); // State for Leaderboard Modal
  
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const partySearchResults = useQuery(api.matches.searchParties, partySearchTerm.trim() ? { searchTerm: partySearchTerm.trim() } : "skip"); 
  const currentUserProfileDetails = useQuery(api.userProfiles.getCurrentUserProfile, loggedInUser ? {} : "skip");
  const unreadNotificationCount = useQuery(api.notifications.getUnreadNotificationCount, loggedInUser ? {} : "skip"); 

  const handleUserClick = (userId: Id<"users">) => {
    setViewingUserId(userId);
    setIsUserProfileModalOpen(true);
  };
  
  const handleCloseUserProfileModal = () => {
    setIsUserProfileModalOpen(false);
    setViewingUserId(null);
  };

  // This function will be passed to UserProfileModal
  // to allow navigation from a profile to another profile (e.g. clicking on a friend)
  const navigateToUserProfile = (userId: Id<"users">) => {
    // It essentially re-triggers the logic for opening a profile
    handleUserClick(userId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md h-20 flex justify-between items-center border-b border-border shadow-sm px-4 md:px-8">
        <div className="flex items-center">
          <img src="/blue-lock-logo-placeholder.png" alt="Tunis Lock Logo" className="h-12 w-auto mr-3"/>
          <h2 className="text-2xl font-bold text-primary">Tunis Lock</h2>
        </div>
        <div className="flex items-center gap-4">
          <Authenticated>
            <Button onClick={() => setShowCreateMatchModal(true)} className="text-sm" type="button" variant="accent">Create Team Match</Button>
            
            {/* Search Users Icon */}
            <button 
              onClick={() => setShowUserSearchModal(true)}
              className="relative p-2 hover:bg-muted rounded-md transition-colors"
              title="Search Egoists"
            >
              <svg className="w-6 h-6 text-card-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Search Parties Icon */}
            <button 
              onClick={() => setShowPartySearchModal(true)}
              className="relative p-2 hover:bg-muted rounded-md transition-colors"
              title="Search Parties"
            >
              🎉
            </button>

            {/* Leaderboard Icon */}
            <button
              onClick={() => setShowLeaderboardModal(true)}
              className="relative p-2 hover:bg-muted rounded-md transition-colors"
              title="Leaderboard"
            >
              🏆
            </button>

            <button 
              onClick={() => setShowNotificationsModal(true)}
              className="relative p-2 hover:bg-muted rounded-md transition-colors"
              title="Notifications"
            >
              🔔
              {unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {loggedInUser && (
                <button onClick={() => handleUserClick(loggedInUser._id)} className="flex items-center gap-2 hover:bg-muted p-2 rounded-md transition-colors">
                <img src={currentUserProfileDetails?.profileImageUrl ?? "/blue-lock-logo-placeholder.png"} alt="My Profile" className="w-8 h-8 rounded-full object-cover border border-primary"/>
                <span className="text-sm font-medium text-card-foreground hidden sm:inline">
                    {currentUserProfileDetails?.displayName ?? currentUserProfileDetails?.name ?? "My Profile"}
                </span>
                </button>
            )}
          </Authenticated>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Unauthenticated>
          <div className="text-center py-10 rounded-xl shadow-2xl bg-cover bg-center" style={{ backgroundImage: "url('/blue-lock-bg-placeholder.jpg')" }}>
            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-lg max-w-2xl mx-auto">
              <img src="/blue-lock-logo-placeholder.png" alt="Tunis Lock" className="h-24 w-auto mx-auto mb-4"/>
              <h1 className="text-5xl font-bold text-primary mb-4">Welcome to Tunis Lock!</h1>
              <p className="text-xl text-text-blue-accent mb-8">Find your rivals, organize team matches, and unleash your ego, Egoist!</p>
              <div className="max-w-md mx-auto bg-card p-8 rounded-xl shadow-inner border border-border"> <SignInForm /> </div>
            </div>
          </div>
        </Unauthenticated>

        <Authenticated>
          {(loggedInUser === undefined || (loggedInUser && currentUserProfileDetails === undefined)) && ( 
            <div className="flex justify-center items-center h-64"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div> </div>
          )}
          {loggedInUser && currentUserProfileDetails && ( 
            <>
              <p className="text-xl text-card-foreground mb-6">
                Welcome back, <span className="font-semibold text-primary">{currentUserProfileDetails.displayName ?? currentUserProfileDetails.name ?? currentUserProfileDetails.email}!</span> Time to find a team match, <span className="text-text-pink-accent">Egoist</span>.
              </p>
              <MatchList currentUserId={loggedInUser._id} onUserClick={handleUserClick} onCreateMatchClick={() => setShowCreateMatchModal(true)} />
              <MyMatchesDashboard currentUserId={loggedInUser._id} onUserClick={handleUserClick} />
            </>
          )}
        </Authenticated>
      </main>

      <Modal isOpen={showCreateMatchModal} onClose={() => setShowCreateMatchModal(false)} title="Create New Team Match" contentClassName="flex-grow">
        <CreateMatchForm onClose={() => setShowCreateMatchModal(false)} />
      </Modal>
      
      {isUserProfileModalOpen && viewingUserId && loggedInUser && (
        <UserProfileModal 
          isOpen={isUserProfileModalOpen} 
          onClose={handleCloseUserProfileModal} 
          userId={viewingUserId}
          viewingOwnProfile={viewingUserId === loggedInUser._id}
          onNavigateToProfile={navigateToUserProfile} // Pass the navigation handler
        />
      )}

      <UserSearchModal 
        isOpen={showUserSearchModal} 
        onClose={() => setShowUserSearchModal(false)} 
        onUserClick={handleUserClick}
      />

      <NotificationsModal 
        isOpen={showNotificationsModal} 
        onClose={() => setShowNotificationsModal(false)} 
        onUserClick={handleUserClick}
      />

      <PartySearchModal 
        isOpen={showPartySearchModal} 
        onClose={() => setShowPartySearchModal(false)}
        searchTerm={partySearchTerm}
        onSearchTermChange={setPartySearchTerm}
        searchResults={partySearchResults}
      />

      <Modal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        title="Global Egoist Leaderboard"
        size="xl"
        contentClassName="bg-background" // Give it a slightly different background
      >
        <Leaderboard onNavigateToProfile={handleUserClick} />
      </Modal>
      
      <Toaster position="top-right" richColors theme="dark" />
      <footer className="text-center p-4 text-muted-foreground border-t border-border bg-card">
        Tunis Lock &copy; {new Date().getFullYear()} - <span className="text-primary">Unleash Your Ego!</span>
      </footer>
    </div>
  );
}
