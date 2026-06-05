package handlers

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"

	"github.com/Twarga/Nodi/internal/config"
)

type DeviceAddress struct {
	Label  string `json:"label"`
	URL    string `json:"url"`
	WebDAV string `json:"webdav"`
}

type DevicesResponse struct {
	Recommended string          `json:"recommended"`
	Addresses   []DeviceAddress `json:"addresses"`
}

// Devices returns the URLs users can open from other devices on the same LAN.
func Devices(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		addresses := deviceAddresses(cfg.Port)
		recommended := ""
		if len(addresses) > 0 {
			recommended = addresses[0].URL
			for _, addr := range addresses {
				if addr.Label == "LAN" {
					recommended = addr.URL
					break
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(DevicesResponse{
			Recommended: recommended,
			Addresses:   addresses,
		})
	}
}

func deviceAddresses(port string) []DeviceAddress {
	addresses := []DeviceAddress{
		deviceAddress("This device", "localhost", port),
	}
	for _, ip := range LocalIPs() {
		addresses = append(addresses, deviceAddress("LAN", ip, port))
	}
	return addresses
}

func deviceAddress(label, host, port string) DeviceAddress {
	base := fmt.Sprintf("http://%s:%s", host, port)
	return DeviceAddress{
		Label:  label,
		URL:    base,
		WebDAV: base + "/dav/",
	}
}

// isDockerIP reports whether an IPv4 address belongs to Docker's default
// bridge network (172.17.0.0/16). This avoids showing container-internal
// addresses as LAN URLs.
func isDockerIP(ip net.IP) bool {
	// 172.17.0.0/16 is Docker's default bridge (docker0).
	if len(ip) != 4 {
		return false
	}
	return ip[0] == 172 && ip[1] == 17
}

// isDockerInterface reports whether a network interface name looks like a
// Docker virtual interface (docker0, br-*, veth*, etc.).
func isDockerInterface(name string) bool {
	return len(name) >= 6 && (name[:6] == "docker" ||
		(len(name) >= 4 && name[:3] == "br-") ||
		(len(name) >= 4 && name[:4] == "veth"))
}

// LocalIPs lists non-loopback IPv4 addresses suitable for LAN connection hints.
func LocalIPs() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var ips []string
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if isDockerInterface(iface.Name) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			if ipv4 := ip.To4(); ipv4 != nil {
				if isDockerIP(ipv4) {
					continue
				}
				ips = append(ips, ipv4.String())
			}
		}
	}
	return ips
}
