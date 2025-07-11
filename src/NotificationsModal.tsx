import React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { toast } from 'sonner';

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

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.data?.message) return error.data.message;
  if (error?.data?.details) return error.data.details;
  if (error?.message) return error.message;
  return "An unknown error occurred.";
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationsModal({ isOpen, onClose, onUserClick }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onUserClick: (userId: Id<"users">) => void;
}) {
  const notifications = useQuery(api.notifications.getMyNotifications);
  const markAsReadMutation = useMutation(api.notifications.markNotificationAsRead);
  const markAllAsReadMutation = useMutation(api.notifications.markAllNotificationsAsRead);
  const acceptFriendRequestMutation = useMutation(api.friends.acceptFriendRequest);
  const declineFriendRequestMutation = useMutation(api.friends.declineFriendRequest);
  const acceptPartyInvitationMutation = useMutation(api.partyInvitations.acceptPartyInvitation);
  const declinePartyInvitationMutation = useMutation(api.partyInvitations.declinePartyInvitation);

  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsReadMutation({ notificationId });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation({});
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAcceptFriendRequest = async (friendRequestId: Id<"friendRequests">, notificationId: Id<"notifications">) => {
    try {
      await acceptFriendRequestMutation({ friendRequestId });
      await markAsReadMutation({ notificationId });
      toast.success("Friend request accepted!");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeclineFriendRequest = async (friendRequestId: Id<"friendRequests">, notificationId: Id<"notifications">) => {
    try {
      await declineFriendRequestMutation({ friendRequestId });
      await markAsReadMutation({ notificationId });
      toast.info("Friend request declined");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAcceptPartyInvitation = async (partyInvitationId: Id<"partyInvitations">, notificationId: Id<"notifications">) => {
    const team = prompt("Which team? (A for Blue, B for Red)");
    if (!team || (team.toUpperCase() !== "A" && team.toUpperCase() !== "B")) {
      toast.error("Please enter 'A' for Blue team or 'B' for Red team");
      return;
    }
    
    const position = prompt("Position? (goalkeeper, defender, midfielder, forward)");
    if (!position || !["goalkeeper", "defender", "midfielder", "forward"].includes(position.toLowerCase())) {
      toast.error("Please enter a valid position");
      return;
    }
    
    try {
      await acceptPartyInvitationMutation({ 
        invitationId: partyInvitationId, 
        team: team.toUpperCase() as "A" | "B",
        position: position.toLowerCase() as "goalkeeper" | "defender" | "midfielder" | "forward"
      });
      await markAsReadMutation({ notificationId });
      toast.success("Party invitation accepted!");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeclinePartyInvitation = async (partyInvitationId: Id<"partyInvitations">, notificationId: Id<"notifications">) => {
    try {
      await declinePartyInvitationMutation({ invitationId: partyInvitationId });
      await markAsReadMutation({ notificationId });
      toast.info("Party invitation declined");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUserProfileClick = (userId: Id<"users">) => {
    onUserClick(userId);
    onClose();
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notifications" size="lg">
      <div className="space-y-4">
        {notifications === undefined && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading notifications...</p>
          </div>
        )}

        {notifications && notifications.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-2">You'll see friend requests and party invitations here</p>
          </div>
        )}

        {notifications && notifications.length > 0 && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
              {unreadCount > 0 && (
                <Button onClick={handleMarkAllAsRead} variant="ghost" size="sm">
                  Mark all as read
                </Button>
              )}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div 
                  key={notification._id} 
                  className={`p-4 rounded-lg border transition-colors ${
                    notification.isRead 
                      ? 'bg-input border-border' 
                      : 'bg-accent/10 border-accent/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {notification.fromUserProfileImageUrl && (
                      <img 
                        src={notification.fromUserProfileImageUrl} 
                        alt={notification.fromUserName ?? "User"} 
                        className="w-10 h-10 rounded-full object-cover border border-primary cursor-pointer"
                        onClick={() => notification.fromUserId && handleUserProfileClick(notification.fromUserId)}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-card-foreground">{notification.message}</p>
                          {notification.matchName && (
                            <p className="text-sm text-accent font-medium mt-1">Match: {notification.matchName}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(notification._creationTime)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
                        )}
                      </div>

                      {/* Friend request actions */}
                      {notification.type === "friend_request_received" && notification.friendRequestId && (
                        <div className="flex gap-2 mt-3">
                          <Button 
                            onClick={() => handleAcceptFriendRequest(notification.friendRequestId!, notification._id)}
                            variant="primary" 
                            size="sm"
                          >
                            Accept
                          </Button>
                          <Button 
                            onClick={() => handleDeclineFriendRequest(notification.friendRequestId!, notification._id)}
                            variant="secondary" 
                            size="sm"
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {/* Party invitation actions */}
                      {notification.type === "party_invitation_received" && notification.partyInvitationId && (
                        <div className="flex gap-2 mt-3">
                          <Button 
                            onClick={() => handleAcceptPartyInvitation(notification.partyInvitationId!, notification._id)}
                            variant="primary" 
                            size="sm"
                          >
                            Join Party
                          </Button>
                          <Button 
                            onClick={() => handleDeclinePartyInvitation(notification.partyInvitationId!, notification._id)}
                            variant="secondary" 
                            size="sm"
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {/* Mark as read button for other notifications */}
                      {!["friend_request_received", "party_invitation_received"].includes(notification.type) && !notification.isRead && (
                        <Button 
                          onClick={() => handleMarkAsRead(notification._id)}
                          variant="ghost" 
                          size="sm"
                          className="mt-2"
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
