import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Check, CheckCircle2, Info, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Notifications() {
  const { toast } = useToast();
  const { data: notifications, isLoading, refetch } = useListNotifications({ pageSize: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync({ notificationId: id });
      refetch();
    } catch (err) {
      toast({ title: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync(undefined);
      toast({ title: "All notifications marked as read" });
      refetch();
    } catch (err) {
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "TimesheetApproved": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "TimesheetRejected": return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "TimesheetSubmitted": return <Info className="h-5 w-5 text-blue-500" />;
      default: return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Notifications</h1>
          <p className="text-muted-foreground mt-1">Stay updated on timesheet statuses and system alerts.</p>
        </div>
        <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllRead.isPending}>
          <Check className="mr-2 h-4 w-4" /> Mark all as read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>Your latest alerts and updates.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : notifications?.items && notifications.items.length > 0 ? (
            <div className="space-y-4">
              {notifications.items.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`flex items-start gap-4 p-4 rounded-lg border ${!notification.isRead ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                >
                  <div className="mt-1">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className={`font-medium ${!notification.isRead ? 'text-foreground' : 'text-foreground/80'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(notification.createdAt), "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                  </div>
                  {!notification.isRead && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markRead.isPending}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              You have no notifications.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}