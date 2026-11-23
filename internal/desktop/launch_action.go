package desktop

import "strings"

const (
	// LaunchActionQuickReceipt navigates directly to creating a new receipt/payment.
	LaunchActionQuickReceipt = "quick-receipt"
	// LaunchActionNewProject navigates directly to creating a new project.
	LaunchActionNewProject = "new-project"
	// LaunchActionCalendar navigates directly to the payment calendar.
	LaunchActionCalendar = "calendar"
	// LaunchActionAnalytics navigates directly to the analytics overview.
	LaunchActionAnalytics = "analytics"
	// LaunchActionSettings navigates directly to desktop settings.
	LaunchActionSettings = "settings"
)

var launchActionRoutes = map[string]string{
	LaunchActionQuickReceipt: "/payment/create",
	LaunchActionNewProject:   "/projects/create",
	LaunchActionCalendar:     routeCalendar,
	LaunchActionAnalytics:    "/analytics",
	LaunchActionSettings:     "/settings?tab=desktop",
}

// ParseLaunchActionRoute extracts a trusted internal route from CLI arguments such as
// `--action=quick-receipt` or `--action quick-receipt` (used by Windows JumpList and Linux
// .desktop Actions). Unknown actions return an empty string.
func ParseLaunchActionRoute(args []string) string {
	for i := 0; i < len(args); i++ {
		arg := strings.TrimSpace(args[i])
		var action string
		switch {
		case strings.HasPrefix(arg, "--action="):
			action = strings.TrimSpace(strings.TrimPrefix(arg, "--action="))
		case arg == "--action" && i+1 < len(args):
			action = strings.TrimSpace(args[i+1])
			i++
		default:
			continue
		}
		if route, ok := launchActionRoutes[strings.ToLower(action)]; ok {
			return route
		}
	}
	return ""
}
