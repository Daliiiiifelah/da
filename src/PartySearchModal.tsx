import React from 'react';
import { Doc, Id } from '../convex/_generated/dataModel';

// --- Reusable Components ---
const Button = ({ onClick, children, className = "", disabled = false, variant = "primary", type, size }: { onClick?: () => void; children: React.ReactNode; className?: string; disabled?: boolean; variant?: "primary" | "secondary" | "danger" | "ghost" | "accent"; type?: "button" | "submit" | "reset", size?: "sm" | "md" }) => {
  const baseStyle = "px-4 py-2 rounded font-semibold shadow-sm hover:shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2" };
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

const Modal = ({ isOpen, onClose, title, children, size = "md" }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) => {
  if (!isOpen) return null;
  const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`bg-card p-6 rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-primary">{title}</h3>
          <Button onClick={onClose} variant="ghost" className="text-muted-foreground hover:text-card-foreground p-1 text-2xl">&times;</Button>
        </div>
        {children}
      </div>
    </div>
  );
};

export function PartySearchModal({ 
  isOpen, 
  onClose, 
  searchTerm, 
  onSearchTermChange, 
  searchResults 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResults: (Doc<"matches"> & { participantCount: number })[] | undefined;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Parties" size="lg">
      <div className="space-y-4">
        <InputField
          placeholder="Search by party name..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />

        {searchTerm.trim() === "" && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Enter a party name to search</p>
          </div>
        )}

        {searchTerm.trim() !== "" && searchResults === undefined && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Searching parties...</p>
          </div>
        )}

        {searchTerm.trim() !== "" && searchResults && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No parties found with that name</p>
            <p className="text-sm text-muted-foreground mt-2">Try a different search term</p>
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {searchResults.map((match) => (
              <div key={match._id} className="p-4 border border-border rounded-lg bg-input">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg text-primary">
                      {match.partyName || `${match.sport} Party`}
                    </h4>
                    <p className="text-sm text-muted-foreground">{match.sport} at {match.location}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(match.dateTime).toLocaleString()}
                    </p>
                    <p className="text-sm text-card-foreground mt-1">
                      <span className="text-text-yellow-accent">{match.participantCount}</span> / {match.playersNeeded} Egoists
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
                </div>
                {match.description && (
                  <p className="text-sm text-muted-foreground mt-2">{match.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
