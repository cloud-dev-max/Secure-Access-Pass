"use client";

import { useEffect, useState, useContext, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PropertyContext } from "@/app/context/PropertyContext";
import {
  Users,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  QrCode,
  Loader2,
  Shield,
  Home,
  TrendingUp,
  Activity,
  Clock,
  LogIn,
  LogOut,
  AlertCircle,
  DollarSign,
  Download,
  Share2,
  Mail,
  MessageSquare,
  Printer,
  Trash2, // V7.5: For delete rule button
  Building2, // V9.0: Portfolio link
  ChevronDown, // V10.8.3: Property dropdown
  Send, // V10.8.4: Send invite button
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import type { Profile, AccessRule, UserRuleStatus } from "@/lib/types/database";
import CsvUploader from "@/components/CsvUploader";
import { createClient } from "@/lib/supabase/client"; // V7.7: For Realtime
// V9.2 Feature #2: Recharts for professional, responsive charts
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

type ProfileWithRules = Profile & {
  rule_statuses: (UserRuleStatus & { rule: AccessRule })[];
};

interface Stats {
  totalResidents: number;
  currentOccupancy: number;
  activeRules: number;
  recentActivity: any[];
  // V6: Occupancy breakdown
  occupancyBreakdown?: {
    residents: number;
    accompanying_guests: number;
    visitor_passes: number;
  };
}

function DashboardPageContent() {
  const router = useRouter();
  
  // V10.8.1: Multi-tenancy - Get active property from context
  const { propertyId, setPropertyId } = useContext(PropertyContext);
  const [currentPropertyName, setCurrentPropertyName] = useState<string>('');
  const [noPropertySelected, setNoPropertySelected] = useState(false);
  
  // V10.8.3: Property dropdown state
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  
  // V10.8.4: Onboarding simulation state
  const [sendingInvites, setSendingInvites] = useState<Set<string>>(new Set());
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());
  const [bulkSendingInvites, setBulkSendingInvites] = useState(false);
  
  const [residents, setResidents] = useState<ProfileWithRules[]>([]);
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalResidents: 0,
    currentOccupancy: 0,
    activeRules: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  // V10.8.51: Persist active tab across property switches using localStorage
  const [activeTab, setActiveTab] = useState<
    "overview" | "residents" | "rules" | "settings" | "revenue" | "occupancy"
  >(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardActiveTab');
      if (saved && ['overview', 'residents', 'rules', 'settings', 'revenue', 'occupancy'].includes(saved)) {
        return saved as any;
      }
    }
    return 'overview';
  });
  
  // V10.8.51: Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardActiveTab', activeTab);
    }
  }, [activeTab]);
  
  // V10.8.9: Reactive tab detection - client-side URL check
  // V10.8.16: Support all tab values from URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam) {
        const validTabs = ['overview', 'residents', 'rules', 'settings', 'revenue', 'occupancy'];
        if (validTabs.includes(tabParam)) {
          console.log('[V10.8.16] Setting active tab from URL:', tabParam);
          setActiveTab(tabParam as any);
        }
      }
    }
  }, [router]); // Depends on router to detect navigation
  const [selectedResident, setSelectedResident] =
    useState<ProfileWithRules | null>(null);
  
  // V9.3 Feature #4: Search & Pagination for large communities
  const [residentSearch, setResidentSearch] = useState("");
  const [residentPage, setResidentPage] = useState(1);
  const [occupancySearch, setOccupancySearch] = useState("");
  const residentsPerPage = 50;

  // V9.4 Feature #1: Hourly Occupancy Trend
  const [trendDate, setTrendDate] = useState(new Date().toISOString().split('T')[0]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [hourlyPeople, setHourlyPeople] = useState<any[]>([]);
  
  // V9.9 Fix #4: Multi-day CSV export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  // New Resident Form
  const [newResidentName, setNewResidentName] = useState("");
  const [newResidentEmail, setNewResidentEmail] = useState("");
  const [newResidentUnit, setNewResidentUnit] = useState("");
  const [newResidentPhone, setNewResidentPhone] = useState("");
  const [newResidentGuestLimit, setNewResidentGuestLimit] = useState(""); // V7.4: Per-resident guest limit
  const [isAddingResident, setIsAddingResident] = useState(false);

  // New Rule Form
  const [newRuleName, setNewRuleName] = useState("");
  const [isAddingRule, setIsAddingRule] = useState(false);

  // Maintenance mode state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  // V7.2: Current Occupancy Tab (modal removed)
  const [insideResidents, setInsideResidents] = useState<ProfileWithRules[]>(
    [],
  );
  const [loadingInsideResidents, setLoadingInsideResidents] = useState(false);

  // V6: Broadcast Alert Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastTargetFilter, setBroadcastTargetFilter] = useState<
    "INSIDE" | "ALL" | "RECENT" | "DATE"
  >("INSIDE");
  const [broadcastDate, setBroadcastDate] = useState(""); // V7.7: Date for historical broadcast

  // V7: Facility Settings
  const [propertyName, setPropertyName] = useState("");
  const [operatingHoursStart, setOperatingHoursStart] = useState("06:00");
  const [operatingHoursEnd, setOperatingHoursEnd] = useState("22:00");
  const [maxCapacity, setMaxCapacity] = useState(50);
  const [guestPassPrice, setGuestPassPrice] = useState(5.0);
  const [maxGuestsPerResident, setMaxGuestsPerResident] = useState(3);
  const [maxVisitorPasses, setMaxVisitorPasses] = useState(100); // V7.2: Max visitor passes (fixed default)
  const [savingSettings, setSavingSettings] = useState(false);
  // V8.12 Fix #3: Cache settings to avoid 8s API calls
  const [settingsCached, setSettingsCached] = useState(false);
  
  // V10.0: Gate Sign QR Generator
  const [showGateSignModal, setShowGateSignModal] = useState(false);
  const [gateSignQRCode, setGateSignQRCode] = useState('');

  // V10.6: Stripe Connect & Payments
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  // V7: Revenue Analytics
  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  // V8.11 Feature #4: Revenue date filter
  const [revenueFilter, setRevenueFilter] = useState<'all' | 'year' | 'month' | 'week'>('all');
  // V10.8.25: Detailed revenue export modal
  const [showRevenueExportModal, setShowRevenueExportModal] = useState(false);
  const [exportingRevenue, setExportingRevenue] = useState(false);

  // V10.8.1: Initialize property from localStorage on mount
  // V10.8.2: Handle missing property gracefully - don't get stuck in infinite loading
  // V10.8.3: Load all properties for dropdown
  useEffect(() => {
    const storedPropertyId = localStorage.getItem('selectedPropertyId');
    
    // Load all properties for dropdown
    // V10.8.15: Auto-select first property if none selected
    const initializeProperty = async () => {
      try {
        const response = await fetch('/api/portfolio');
        if (response.ok) {
          const data = await response.json();
          if (data && data.properties) {
            setAllProperties(data.properties);
            
            // V10.8.15: If no property selected, auto-select first one
            if (!storedPropertyId && !propertyId && data.properties.length > 0) {
              const firstProperty = data.properties[0];
              console.log('[V10.8.15] Auto-selecting first property:', firstProperty.name);
              setPropertyId(firstProperty.id);
              localStorage.setItem('selectedPropertyId', firstProperty.id);
              setCurrentPropertyName(firstProperty.name);
              setLoading(false);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error loading properties:', error);
      }
      
      // Original logic
      if (storedPropertyId && !propertyId) {
        // Property found in localStorage - set it
        setPropertyId(storedPropertyId);
        setLoading(false);
      } else if (!storedPropertyId && !propertyId) {
        // V10.8.2 Fix: No property selected - stop loading and show selection prompt
        setNoPropertySelected(true);
        setLoading(false);
      }
    };
    
    initializeProperty();
  }, []);

  // V10.8.1: Load property name when propertyId changes
  useEffect(() => {
    if (propertyId) {
      fetch(`/api/properties?id=${propertyId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.name) {
            setCurrentPropertyName(data.name);
          }
        })
        .catch(err => console.error('Error loading property name:', err));
    }
  }, [propertyId]);

  // V10.8.3: Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showPropertyDropdown && !target.closest('.relative')) {
        setShowPropertyDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPropertyDropdown]);

  // V10.8.1: Reload data when property changes
  // V10.8.2: Only load data when propertyId is available
  // V10.8.14: Clear settings cache when property changes to force fresh load
  useEffect(() => {
    if (!propertyId) return;
    
    // V10.8.14: Invalidate settings cache to prevent stale data
    setSettingsCached(false);
    
    loadData();
    loadMaintenanceStatus();
    loadOccupancyBreakdown(); // V6
    loadInsideResidents(); // V8.11 Fix #1: Load occupancy data on mount
    loadFacilitySettings(true); // V10.8.14: Force reload settings for new property
    // V7.1: Load revenue after mount to avoid undefined function error
    loadRevenueData();
  }, [propertyId]);

  useEffect(() => {
    if (activeTab === "revenue") {
      loadRevenueData();
    }
    // V9.4 Feature #1: Load hourly trend when occupancy tab is active
    if (activeTab === "occupancy") {
      loadHourlyTrend(trendDate);
    }
  }, [activeTab]);

  // V9.4 Feature #1: Reload trend when date changes
  useEffect(() => {
    if (activeTab === "occupancy") {
      loadHourlyTrend(trendDate);
    }
  }, [trendDate]);

  // V8.4 Fix #6: Don't pre-fill Guest Limit - let it be empty (uses default)
  // Removed auto-fill logic - field should remain empty unless user explicitly sets it

  // V8.11 Fix #2: Poll for maintenance status updates every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadMaintenanceStatus();
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // V7.7 Fix #1: Supabase Realtime listener for instant activity updates
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to access_logs changes for Recent Activity
    const accessLogsChannel = supabase
      .channel("access_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "access_logs",
        },
        (payload) => {
          console.log("[Realtime] Access log change:", payload);
          // V8.6 Fix #2: Silent background refresh (no loading spinner)
          loadOccupancyBreakdown(true);
          loadInsideResidents(true);
          // Reload stats for Recent Activity widget
          fetch('/api/stats')
            .then(res => res.json())
            .then(data => setStats(prev => ({ ...prev, recentActivity: data.recentActivity || [] })))
            .catch(err => console.error('Error refreshing stats:', err));
        },
      )
      .subscribe();

    // Subscribe to profiles changes for occupancy updates
    const profilesChannel = supabase
      .channel("profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: "role=eq.resident",
        },
        (payload) => {
          console.log("[Realtime] Profile updated:", payload);
          // V8.6 Fix #2: Silent background refresh (no loading spinner)
          loadOccupancyBreakdown(true);
          loadInsideResidents(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(accessLogsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  // V10.8.12: Pass property_id for multi-tenancy isolation
  const loadMaintenanceStatus = async () => {
    if (!propertyId) return;
    
    try {
      const response = await fetch(`/api/settings?property_id=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setIsMaintenanceMode(data.is_maintenance_mode || false);
      }
    } catch (error) {
      console.error("Error loading maintenance status:", error);
    }
  };

  // V6: Load occupancy breakdown
  const loadOccupancyBreakdown = async () => {
    // V10.8.17: Pass property_id to occupancy API
    if (!propertyId) return;
    
    try {
      const response = await fetch(`/api/occupancy?property_id=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setStats((prev) => ({
          ...prev,
          currentOccupancy: data.total,
          occupancyBreakdown: {
            residents: data.residents,
            accompanying_guests: data.accompanying_guests,
            visitor_passes: data.visitor_passes,
          },
        }));
      }
    } catch (error) {
      console.error("Error loading occupancy breakdown:", error);
    }
  };

  // V10.8.3: Load all properties for dropdown
  const loadAllProperties = async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (response.ok) {
        const data = await response.json();
        if (data && data.properties) {
          setAllProperties(data.properties);
        }
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  // V10.8.3: Switch property from dropdown
  const switchProperty = (newPropertyId: string, newPropertyName: string) => {
    // Update context
    setPropertyId(newPropertyId);
    // Update localStorage for persistence
    localStorage.setItem('selectedPropertyId', newPropertyId);
    // Update displayed name
    setCurrentPropertyName(newPropertyName);
    // Close dropdown
    setShowPropertyDropdown(false);
    // Data will reload automatically via useEffect dependency on propertyId
  };

  // V10.8.4: Simulate sending invite email to individual resident
  const sendInviteEmail = async (residentId: string) => {
    // Add to sending state
    setSendingInvites(prev => new Set(prev).add(residentId));
    
    // Simulate API call delay (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Remove from sending, add to sent
    setSendingInvites(prev => {
      const newSet = new Set(prev);
      newSet.delete(residentId);
      return newSet;
    });
    setSentInvites(prev => new Set(prev).add(residentId));
    
    // Show success notification (browser alert for MVP)
    alert('✅ Welcome email sent with Portal Link and PIN!');
  };

  // V10.8.4: Simulate sending invites to all residents
  const sendBulkInvites = async () => {
    setBulkSendingInvites(true);
    
    // Simulate API call delay (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mark all residents as sent
    const allResidentIds = residents.map(r => r.id);
    setSentInvites(new Set(allResidentIds));
    setBulkSendingInvites(false);
    
    // Show success notification
    alert(`✅ Welcome emails sent to ${residents.length} residents with Portal Links and PINs!`);
  };

  // V10.8.6: Delete resident with confirmation
  const deleteResident = async (residentId: string, residentName: string) => {
    // Browser confirmation
    const confirmed = window.confirm(
      `⚠️ Are you sure you want to permanently delete ${residentName}?\n\nThis will remove:\n• Resident profile\n• All access rule statuses\n• All guest passes\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/residents?id=${residentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete resident');
      }
      
      // Reload data to reflect deletion
      await loadData();
      alert('✅ Resident permanently deleted');
    } catch (error) {
      console.error('Error deleting resident:', error);
      alert('❌ Failed to delete resident. Please try again.');
    }
  };

  const loadData = async () => {
    if (!propertyId) return; // V10.8.1: Require property selection
    
    setLoading(true);
    
    // V10.8.50: Fetch APIs individually to prevent Promise rejection cascade
    // If one API fails, others can still succeed
    
    // Fetch residents
    try {
      const residentsRes = await fetch(`/api/residents?property_id=${propertyId}`);
      if (residentsRes.ok) {
        const residentsData = await residentsRes.json();
        setResidents(Array.isArray(residentsData) ? residentsData : []);
      } else {
        console.error("Residents API error:", residentsRes.status);
        setResidents([]);
      }
    } catch (error) {
      console.error("Error fetching residents:", error);
      setResidents([]);
    }

    // Fetch rules
    try {
      const rulesRes = await fetch(`/api/rules?property_id=${propertyId}`);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(
          Array.isArray(rulesData)
            ? rulesData.filter((r: AccessRule) => r.is_active)
            : [],
        );
      } else {
        console.error("Rules API error:", rulesRes.status);
        setRules([]);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
      setRules([]);
    }

    // Fetch stats
    try {
      const statsRes = await fetch(`/api/stats?property_id=${propertyId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        console.error("Stats API error:", statsRes.status);
        // Don't update stats if fetch fails - leave existing data intact
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Don't update stats if fetch fails - leave existing data intact
    }

    setLoading(false);
  };

  const toggleRule = async (
    userId: string,
    ruleId: string,
    currentStatus: boolean,
  ) => {
    // OPTIMISTIC UI UPDATE - Update immediately
    const newStatus = !currentStatus;
    setResidents((prevResidents) =>
      prevResidents.map((r) => {
        if (r.id === userId) {
          return {
            ...r,
            rule_statuses: r.rule_statuses.map((rs) =>
              rs.rule_id === ruleId ? { ...rs, status: newStatus } : rs,
            ),
          };
        }
        return r;
      }),
    );

    // Save to backend in background
    try {
      const response = await fetch("/api/toggle-rule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          rule_id: ruleId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle rule");
      }
    } catch (error) {
      console.error("Error toggling rule:", error);
      // Revert on error
      setResidents((prevResidents) =>
        prevResidents.map((r) => {
          if (r.id === userId) {
            return {
              ...r,
              rule_statuses: r.rule_statuses.map((rs) =>
                rs.rule_id === ruleId ? { ...rs, status: currentStatus } : rs,
              ),
            };
          }
          return r;
        }),
      );
      alert("Failed to update rule status");
    }
  };

  const toggleMaintenanceMode = async () => {
    const newMode = !isMaintenanceMode;

    // V10.8.14: Check for propertyId
    if (!propertyId) {
      alert('No property selected');
      return;
    }

    // V4: Require reason when enabling maintenance mode
    if (newMode) {
      const reason = prompt(
        "Enter closure reason (e.g., Thunderstorm, Maintenance, Cleaning):",
      );
      if (!reason || reason.trim() === "") {
        alert("Closure reason is required");
        return;
      }
      setMaintenanceReason(reason.trim());
    }

    // Optimistic update
    setIsMaintenanceMode(newMode);
    setTogglingMaintenance(true);

    try {
      // V10.8.14: Pass property_id to ensure correct property is updated
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId, // V10.8.14: Use current propertyId from context
          is_maintenance_mode: newMode,
          maintenance_reason: newMode ? maintenanceReason : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle maintenance mode");
      }

      // V7.8 Feature #3: Log status change to activity log
      const newStatus = newMode ? "CLOSED" : "OPENED";
      await logStatusChange(
        newStatus,
        "Manager Dashboard",
        newMode ? maintenanceReason : "",
      );

      // Reload stats to reflect changes
      await loadMaintenanceStatus();
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      // Revert on error
      setIsMaintenanceMode(!newMode);
      alert("Failed to toggle maintenance mode");
    } finally {
      setTogglingMaintenance(false);
    }
  };

  // V7.8 Feature #3: Log pool status changes to activity log
  const logStatusChange = async (
    newStatus: string,
    source: string,
    reason: string,
  ) => {
    try {
      await fetch("/api/log-status-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_status: newStatus,
          source,
          reason,
        }),
      });
    } catch (error) {
      console.error("Error logging status change:", error);
    }
  };

  // V6: Broadcast health alert
  // V10.8.15: Pass property_id explicitly (no legacy fallback)
  const sendBroadcastAlert = async () => {
    if (!broadcastMessage || broadcastMessage.trim() === "") {
      alert("Please enter a message");
      return;
    }

    if (!propertyId) {
      alert("No property selected");
      return;
    }

    setSendingBroadcast(true);
    try {
      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId, // V10.8.15: Explicit property_id required
          message: broadcastMessage.trim(),
          target_filter: broadcastTargetFilter,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send broadcast");
      }

      const data = await response.json();
      const targetDesc =
        broadcastTargetFilter === "INSIDE"
          ? "currently inside"
          : broadcastTargetFilter === "RECENT"
            ? "who visited recently (last 4 hours)"
            : "active residents";
      alert(`Alert sent to ${data.recipients_count} resident(s) ${targetDesc}`);
      setBroadcastMessage("");
      setBroadcastTargetFilter("INSIDE");
      setShowBroadcastModal(false);
    } catch (error) {
      console.error("Error sending broadcast:", error);
      alert("Failed to send broadcast alert");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // V8.4 Fix #1: Load who is inside (residents + visitor passes)
  // V8.6 Fix #2: Add silent parameter for background polling (no loading spinner)
  const loadInsideResidents = async (silent = false) => {
    if (!propertyId) return; // V10.8.16: Wait for propertyId
    
    if (!silent) {
      setLoadingInsideResidents(true);
    }
    try {
      // Use unified occupancy endpoint that includes visitors
      // V10.8.16: Pass property_id explicitly
      const response = await fetch(`/api/occupancy-list?property_id=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        // Transform occupants into format expected by the table
        const formattedOccupants = data.occupants.map((occ: any) => {
          if (occ.type === "visitor") {
            return {
              id: occ.id,
              name: `Visitor Pass (Guest of ${occ.purchaser_name})`,
              unit: occ.purchaser_unit,
              email: "N/A",
              last_scan_at: null,
              active_guests: 0,
              is_visitor: true, // Flag for special handling
              visitor_id: occ.id,
            };
          } else {
            // Regular resident
            const resident = residents.find((r) => r.id === occ.id);
            return (
              resident || {
                id: occ.id,
                name: occ.name,
                unit: occ.unit,
                active_guests: occ.active_guests,
                is_visitor: false,
              }
            );
          }
        });
        setInsideResidents(formattedOccupants);
      }

      // V7.3: Also reload occupancy breakdown to update cards
      await loadOccupancyBreakdown(silent);
    } catch (error) {
      console.error("Error loading inside residents:", error);
    } finally {
      if (!silent) {
        setLoadingInsideResidents(false);
      }
    }
  };

  // V8.4 Fix #1: Force check out (handles both residents and visitors)
  const handleForceCheckout = async (personId: string) => {
    const person = insideResidents.find((r) => r.id === personId);
    if (!person) return;

    const isVisitor = person.is_visitor === true;
    const confirmMessage = isVisitor
      ? "Force check out this visitor? They will be marked as OUTSIDE."
      : "Force check out this resident? They will be marked as OUTSIDE.";

    if (!confirm(confirmMessage)) return;

    try {
      if (isVisitor) {
        // Force exit visitor pass
        const response = await fetch("/api/guest-passes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: person.visitor_id || personId,
            is_inside: false,
          }),
        });
        if (!response.ok) throw new Error("Failed to check out visitor");
      } else {
        // Force exit resident
        const response = await fetch("/api/residents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: personId,
            current_location: "OUTSIDE",
          }),
        });
        if (!response.ok) throw new Error("Failed to update location");
      }

      // Reload data
      await loadInsideResidents();
    } catch (error) {
      console.error("Error forcing checkout:", error);
      alert("Failed to force checkout");
    }
  };

  // V4: Force check out a resident (legacy function - keeping for compatibility)
  const forceCheckout = async (residentId: string) => {
    return handleForceCheckout(residentId);
  };

  // V8.7 Feature #3: Clear all occupants
  const clearAllOccupants = async () => {
    if (!confirm('⚠️ Clear ALL occupants? This will mark all residents and visitors as OUTSIDE. This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/clear-occupancy', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to clear occupants');

      alert('✓ All occupants cleared successfully');
      await loadInsideResidents();
      await loadOccupancyBreakdown();
    } catch (error) {
      console.error('Error clearing occupants:', error);
      alert('Failed to clear occupants');
    }
  };

  // V10.8.8: Regenerate PIN for resident - upgraded to 6 digits
  const regeneratePin = async (residentId: string) => {
    if (!confirm("Generate a new secure 6-digit PIN for this resident?")) {
      return;
    }

    try {
      // V10.8.8: Generate 6-digit PIN (100000-999999)
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();
      const response = await fetch("/api/residents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: residentId,
          access_pin: newPin,
        }),
      });

      if (!response.ok) throw new Error("Failed to regenerate PIN");

      alert(`✅ 6-digit PIN created successfully: ${newPin}`);
      await loadData();
    } catch (error) {
      console.error("Error regenerating PIN:", error);
      alert("Failed to regenerate PIN");
    }
  };

  // V9.4 Feature #1: Load hourly occupancy trend
  const loadHourlyTrend = async (date: string) => {
    setLoadingTrend(true);
    setSelectedHour(null);
    setHourlyPeople([]);
    try {
      // V10.8.52: Add missing property_id parameter
      const response = await fetch(`/api/occupancy-trend?date=${date}&property_id=${propertyId}`);
      if (!response.ok) throw new Error('Failed to load trend data');
      const data = await response.json();
      setTrendData(data.hourlyTrend || []);
    } catch (error) {
      console.error('Error loading hourly trend:', error);
      setTrendData([]);
    } finally {
      setLoadingTrend(false);
    }
  };

  // V9.12 HARD FIX #3: Fetch 24h prior + target day (same as chart API)
  // V9.13 Fix #2: Single Source of Truth - Use people array from backend
  const loadPeopleAtHour = async (hour: string) => {
    try {
      // Find the hour data from the cached trendData
      const hourData = trendData.find(d => d.hour === hour);
      
      if (hourData && hourData.people) {
        // Map backend people format to display format
        const displayPeople = hourData.people.map((p: any) => ({
          name: p.name,
          unit: p.unit || 'N/A',
          guests: p.guests,
          totalPeople: p.total
        }));
        
        setHourlyPeople(displayPeople);
      } else {
        setHourlyPeople([]);
      }
    } catch (error) {
      console.error('Error loading people at hour:', error);
      setHourlyPeople([]);
    }
  };

  // V9.4 Feature #1: Export hourly trend CSV
  // V9.9 Fix #4: Multi-day CSV export function
  const exportMultiDayTrendCSV = async () => {
    try {
      setIsExporting(true);
      
      // Parse date range
      const startDate = new Date(exportStartDate);
      const endDate = new Date(exportEndDate);
      
      // Validate date range
      if (startDate > endDate) {
        alert('Start date must be before or equal to end date');
        setIsExporting(false);
        return;
      }
      
      // Build CSV data by fetching each day's data
      const allRows: any[] = [];
      const headers = ['Date', 'Time', 'Occupancy Count'];
      
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // V10.8.52: Add missing property_id parameter
        const response = await fetch(`/api/occupancy-trend?date=${dateStr}&property_id=${propertyId}`);
        if (response.ok) {
          const data = await response.json();
          (data.hourlyTrend || []).forEach((point: any) => {
            allRows.push([dateStr, point.hour, point.occupancy]);
          });
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Generate CSV content with UTF-8 BOM
      const csvContent = [
        '\uFEFF', // UTF-8 BOM
        `Multi-Day Hourly Occupancy Trend`,
        `Date Range: ${exportStartDate} to ${exportEndDate}`,
        `Generated: ${new Date().toLocaleString()}`,
        `Total Records: ${allRows.length}`,
        '',
        headers.join(','),
        ...allRows.map(row => row.join(','))
      ].join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `occupancy-trend-${exportStartDate}-to-${exportEndDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Close modal
      setShowExportModal(false);
      setIsExporting(false);
    } catch (error) {
      console.error('Error exporting multi-day trend CSV:', error);
      alert('Failed to export trend data');
      setIsExporting(false);
    }
  };

  // V7.1: Update personal guest limit
  const updatePersonalGuestLimit = async (
    residentId: string,
    newLimit: number | null,
  ) => {
    try {
      const response = await fetch("/api/residents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: residentId,
          personal_guest_limit: newLimit,
        }),
      });

      if (!response.ok) throw new Error("Failed to update guest limit");

      await loadData();
    } catch (error) {
      console.error("Error updating guest limit:", error);
      alert("Failed to update guest limit");
    }
  };

  // V7: Load Facility Settings
  // V8.12 Fix #3: Optimized settings load with caching
  // V10.8.11: Pass property_id for multi-tenancy isolation
  const loadFacilitySettings = async (force = false) => {
    // Skip if already cached and not forcing reload
    if (settingsCached && !force) {
      return;
    }
    
    if (!propertyId) {
      console.log('[V10.8.11] No propertyId, skipping settings load');
      return;
    }
    
    try {
      console.log('[V10.8.11] Loading settings for property:', propertyId);
      const response = await fetch(`/api/settings?property_id=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setPropertyName(data.property_name || "");
        setOperatingHoursStart(data.operating_hours_start || "06:00");
        setOperatingHoursEnd(data.operating_hours_end || "22:00");
        setMaxCapacity(data.max_capacity || 50);
        setGuestPassPrice(data.guest_pass_price || 5.0);
        setMaxGuestsPerResident(data.max_guests_per_resident || 3);
        setMaxVisitorPasses(data.max_visitor_passes || 100); // V7.2
        setStripeAccountId(data.stripe_account_id || ''); // V10.6
        setStripeConnected(data.stripe_connected || false); // V10.6
        setSettingsCached(true); // Mark as cached
      }
    } catch (error) {
      console.error("Error loading facility settings:", error);
    }
  };

  // V7: Save Facility Settings
  // V10.8.11: Pass property_id and refresh header dropdown
  const saveFacilitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    if (!propertyId) {
      alert('No property selected');
      setSavingSettings(false);
      return;
    }

    try {
      console.log('[V10.8.11] Saving settings for property:', propertyId);
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId, // V10.8.11: Pass active property
          property_name: propertyName,
          operating_hours_start: operatingHoursStart,
          operating_hours_end: operatingHoursEnd,
          max_capacity: maxCapacity,
          guest_pass_price: guestPassPrice,
          max_guests_per_resident: maxGuestsPerResident,
          max_visitor_passes: maxVisitorPasses, // V7.1
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      alert("Settings saved successfully!");
      setSettingsCached(false); // V8.12: Invalidate cache
      await loadFacilitySettings(true); // Force reload
      
      // V10.8.11: Refresh header dropdown to show updated property name
      await loadAllProperties();
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // V10.0: Generate Gate Sign QR Code
  const generateGateSign = () => {
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001';
    const checkInUrl = `${window.location.origin}/check-in/${propertyId}`;
    setGateSignQRCode(checkInUrl);
    setShowGateSignModal(true);
  };

  // V10.0: Print Gate Sign
  const printGateSign = () => {
    window.print();
  };

  // V10.6: Connect Stripe Account
  // V10.8.16: Pass property_id to preserve context during OAuth
  const connectStripeAccount = async () => {
    if (!propertyId) {
      alert('No property selected');
      return;
    }

    setConnectingStripe(true);
    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId, // V10.8.16: Preserve property context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect Stripe account');
      }

      const data = await response.json();
      setStripeAccountId(data.account_id);
      setStripeConnected(true);
      alert(`✅ Stripe Connected!\n\nDemo Account ID: ${data.account_id}\n\nYou can now accept payments in Demo Mode.`);
      
      // V10.8.16: Reload property data and refresh allProperties
      await loadFacilitySettings(true);
      await loadAllProperties(); // Refresh header dropdown
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      alert('Failed to connect Stripe account');
    } finally {
      setConnectingStripe(false);
    }
  };

  // V10.6: Disconnect Stripe Account
  // V10.8.16: Pass property_id query parameter
  const disconnectStripeAccount = async () => {
    if (!confirm('Are you sure you want to disconnect your Stripe account?')) {
      return;
    }

    if (!propertyId) {
      alert('No property selected');
      return;
    }

    try {
      const response = await fetch(`/api/stripe/connect?property_id=${propertyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Stripe account');
      }

      setStripeAccountId('');
      setStripeConnected(false);
      alert('Stripe account disconnected successfully');
      
      // V10.8.16: Reload property data and refresh allProperties
      await loadFacilitySettings(true);
      await loadAllProperties(); // Refresh header dropdown
    } catch (error) {
      console.error('Error disconnecting Stripe:', error);
      alert('Failed to disconnect Stripe account');
    }
  };

  // V7: Load Revenue Data
  const loadRevenueData = async () => {
    // V10.8.19: Pass property_id to revenue API for correct filtering
    if (!propertyId) return;
    
    setRevenueLoading(true);
    try {
      // V10.8.32: Generate local timezone boundaries on frontend using new Date()
      const now = new Date();
      
      // Today boundaries (00:00:00 to 23:59:59 in local timezone)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      // Last 7 days start (7 days ago at 00:00:00)
      const last7DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      
      // This month boundaries
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Build URL with timezone boundaries
      const url = `/api/revenue?property_id=${propertyId}` +
        `&todayStart=${todayStart.toISOString()}` +
        `&todayEnd=${todayEnd.toISOString()}` +
        `&last7DaysStart=${last7DaysStart.toISOString()}` +
        `&thisMonthStart=${thisMonthStart.toISOString()}` +
        `&thisMonthEnd=${thisMonthEnd.toISOString()}`;
      
      console.log('[V10.8.32] Local timezone boundaries:', {
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
        last7DaysStart: last7DaysStart.toISOString(),
        thisMonthStart: thisMonthStart.toISOString(),
        thisMonthEnd: thisMonthEnd.toISOString()
      });
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRevenueData(data);
      }
    } catch (error) {
      console.error("Error loading revenue data:", error);
      setRevenueData(null);
    } finally {
      setRevenueLoading(false);
    }
  };

  // V8.11 Feature #4: Calculate filtered revenue based on date range
  const getFilteredRevenue = () => {
    if (!revenueData) return { revenue: 0, passes: 0 };
    
    const now = new Date();
    let startDate: Date;
    
    switch (revenueFilter) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        return { revenue: revenueData.summary.last7Days.revenue, passes: revenueData.summary.last7Days.count };
      case 'month':
        return { revenue: revenueData.summary.currentMonth.revenue, passes: revenueData.summary.currentMonth.count };
      case 'year':
        // Calculate year total from monthly data
        const yearRevenue = revenueData.charts.monthly
          .filter((m: any) => {
            const monthDate = new Date(m.month);
            return monthDate.getFullYear() === now.getFullYear();
          })
          .reduce((sum: number, m: any) => sum + m.revenue, 0);
        const yearPasses = revenueData.charts.monthly
          .filter((m: any) => {
            const monthDate = new Date(m.month);
            return monthDate.getFullYear() === now.getFullYear();
          })
          .reduce((sum: number, m: any) => sum + m.count, 0);
        return { revenue: yearRevenue, passes: yearPasses };
      case 'all':
      default:
        return { revenue: revenueData.summary.totalRevenue, passes: revenueData.summary.totalPasses };
    }
  };

  // V8.11 Feature #4: Export revenue data to CSV
  const exportRevenueCSV = () => {
    if (!revenueData) return;
    
    const { revenue, passes } = getFilteredRevenue();
    const filterLabel = revenueFilter === 'all' ? 'All-Time' : 
                       revenueFilter === 'year' ? 'This Year' :
                       revenueFilter === 'month' ? 'This Month' : 'Last 7 Days';
    
    // Create CSV content
    const headers = ['Date', 'Revenue', 'Passes Sold', 'Price Per Pass'];
    let rows: string[][] = [];
    
    if (revenueFilter === 'week' || revenueFilter === 'all') {
      revenueData.charts.daily.forEach((day: any) => {
        if (day.revenue > 0) {
          rows.push([day.date, `$${day.revenue.toFixed(2)}`, day.count.toString(), `$${revenueData.summary.guestPassPrice.toFixed(2)}`]);
        }
      });
    } else if (revenueFilter === 'month' || revenueFilter === 'year') {
      revenueData.charts.monthly.forEach((month: any) => {
        if (month.revenue > 0) {
          rows.push([month.month, `$${month.revenue.toFixed(2)}`, month.count.toString(), `$${revenueData.summary.guestPassPrice.toFixed(2)}`]);
        }
      });
    }
    
    // Add summary row
    rows.push(['', '', '', '']);
    rows.push(['TOTAL', `$${revenue.toFixed(2)}`, passes.toString(), `$${revenueData.summary.guestPassPrice.toFixed(2)}`]);
    
    const csvContent = [
      `Revenue Report - ${filterLabel}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${revenueFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // V10.8.25: Export detailed revenue with date range filter
  const exportDetailedRevenueCSV = async () => {
    if (!propertyId) {
      alert('Please select a property');
      return;
    }

    setExportingRevenue(true);
    try {
      // Build URL with date filters
      let url = `/api/revenue/detailed?property_id=${propertyId}`;
      if (exportStartDate) url += `&start_date=${exportStartDate}`;
      if (exportEndDate) url += `&end_date=${exportEndDate}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch detailed revenue');

      const data = await response.json();
      const transactions = data.transactions || [];

      // CSV headers
      const headers = ['Date/Time', 'Resident Name', 'Unit', 'Passes Bought', 'Amount Paid'];
      
      // CSV rows
      const rows = transactions.map((txn: any) => [
        new Date(txn.created_at).toLocaleString(),
        txn.resident_name || 'Unknown',
        txn.unit || 'N/A',
        txn.guest_count || 1,
        `$${(txn.amount_paid || txn.price_paid || 0).toFixed(2)}`
      ]);

      // Calculate totals
      const totalPasses = transactions.reduce((sum: number, txn: any) => sum + (txn.guest_count || 1), 0);
      const totalRevenue = transactions.reduce((sum: number, txn: any) => sum + (txn.amount_paid || txn.price_paid || 0), 0);

      // Add summary rows
      rows.push(['', '', '', '', '']);
      rows.push(['TOTALS', '', '', totalPasses.toString(), `$${totalRevenue.toFixed(2)}`]);

      const dateRangeLabel = exportStartDate || exportEndDate
        ? `${exportStartDate || 'Beginning'} to ${exportEndDate || 'Today'}`
        : 'All Time';

      const csvContent = [
        `Detailed Revenue Report - ${dateRangeLabel}`,
        `Property: ${allProperties.find(p => p.id === propertyId)?.name || 'N/A'}`,
        `Generated: ${new Date().toLocaleString()}`,
        `Total Transactions: ${transactions.length}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url2 = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url2;
      a.download = `detailed-revenue-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url2);

      // Close modal and reset
      setShowRevenueExportModal(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch (error) {
      console.error('[V10.8.25] Error exporting detailed revenue:', error);
      alert('Failed to export detailed revenue. Please try again.');
    } finally {
      setExportingRevenue(false);
    }
  };

  // V8.11 Feature #4: Export activity log to CSV
  const exportActivityCSV = async () => {
    try {
      const response = await fetch('/api/activity-logs?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      
      const data = await response.json();
      const logs = data.logs || [];
      
      const headers = ['Timestamp', 'Name', 'Type', 'Action', 'Result', 'Unit'];
      const rows = logs.map((log: any) => [
        new Date(log.created_at).toLocaleString(),
        log.resident_name || 'Unknown',
        log.user_type === 'visitor_pass' ? 'Visitor Pass' : 'Resident',
        log.event_type || 'SCAN',
        log.result || 'N/A',
        log.resident_unit || 'N/A'
      ]);
      
      const csvContent = [
        'Access Activity Log',
        `Generated: ${new Date().toLocaleString()}`,
        `Total Records: ${logs.length}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting activity log:', error);
      alert('Failed to export activity log');
    }
  };

  const addResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingResident(true);

    try {
      // V7.4: Parse guest limit (empty = use default)
      const guestLimit =
        newResidentGuestLimit.trim() === ""
          ? null
          : parseInt(newResidentGuestLimit);

      const response = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newResidentName,
          email: newResidentEmail,
          unit: newResidentUnit,
          phone: newResidentPhone,
          personal_guest_limit: guestLimit, // V7.4: Send personal limit
          property_id: propertyId, // V10.8.1: Multi-tenancy
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to add resident:", errorData);
        alert(`Failed to add resident: ${errorData.error || "Unknown error"}`);
        return;
      }

      // Reset form
      setNewResidentName("");
      setNewResidentEmail("");
      setNewResidentUnit("");
      setNewResidentPhone("");
      setNewResidentGuestLimit(""); // V7.4: Reset guest limit

      // Reload data
      await loadData();
    } catch (error) {
      console.error("Error adding resident:", error);
      alert("Network error. Please check your connection and try again.");
    } finally {
      setIsAddingResident(false);
    }
  };

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingRule(true);

    // V10.8.10: Critical fix - explicitly pass active propertyId from context
    if (!propertyId) {
      alert('Please select a property first');
      setIsAddingRule(false);
      return;
    }

    try {
      console.log('[V10.8.10] Adding rule to property:', propertyId);
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_name: newRuleName,
          property_id: propertyId, // V10.8.10: Pass active property from context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to add rule:", errorData);
        alert(`Failed to add rule: ${errorData.error || "Unknown error"}`);
        return;
      }

      // Reset form
      setNewRuleName("");

      // Reload data
      await loadData();
    } catch (error) {
      console.error("Error adding rule:", error);
      alert("Network error. Please check your connection and try again.");
    } finally {
      setIsAddingRule(false);
    }
  };

  // V7.5 Issue #7: Delete access rule
  const deleteRule = async (ruleId: string, ruleName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the rule "${ruleName}"? This will remove it from all residents.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to delete rule:", errorData);
        alert(`Failed to delete rule: ${errorData.error || "Unknown error"}`);
        return;
      }

      // Reload data
      await loadData();
    } catch (error) {
      console.error("Error deleting rule:", error);
      alert("Network error. Please check your connection and try again.");
    }
  };

  const getRuleStatus = (
    resident: ProfileWithRules,
    ruleId: string,
  ): boolean => {
    const ruleStatus = resident.rule_statuses?.find(
      (rs) => rs.rule_id === ruleId,
    );
    return ruleStatus?.status ?? false;
  };

  // V9.12 HARD FIX #2: EXACT copy of resident page canvas logic
  const downloadFullIDCard = (resident: ProfileWithRules) => {
    const idCanvas = document.createElement("canvas");
    const ctx = idCanvas.getContext("2d");
    if (!ctx) return;

    // Set card dimensions (standard ID card ratio) - EXACT match
    const cardWidth = 800;
    const cardHeight = 500;
    idCanvas.width = cardWidth;
    idCanvas.height = cardHeight;

    // Background gradient - EXACT match
    const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
    gradient.addColorStop(0, "#0f172a"); // navy-900
    gradient.addColorStop(0.5, "#1e293b"); // navy-800
    gradient.addColorStop(1, "#0d9488"); // teal-600
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Top accent bar - EXACT match
    ctx.fillStyle = "#14b8a6"; // teal-500
    ctx.fillRect(0, 0, cardWidth, 60);

    // Property name (top bar) - Use propertyName from state
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(propertyName || "Secure Access Pass", cardWidth / 2, 42);

    // Card title - EXACT match
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillStyle = "#14b8a6"; // teal-500
    ctx.textAlign = "left";
    ctx.fillText("Pool Access Pass", 40, 120);

    // Resident name - EXACT match
    ctx.font = "bold 42px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(resident.name, 40, 180);

    // Unit number - EXACT match
    ctx.font = "28px Arial, sans-serif";
    ctx.fillStyle = "#cbd5e1"; // gray-300
    ctx.fillText(`Unit ${resident.unit}`, 40, 220);

    // Email - EXACT match
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#94a3b8"; // gray-400
    ctx.fillText(resident.email, 40, 260);

    // Status badge with proper padding - EXACT match
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.textAlign = "center";
    const badgeText = "✓ VALID RESIDENT";
    const textWidth = ctx.measureText(badgeText).width;
    const badgeX = 40;
    const badgeY = 290;
    const badgePadding = 20; // 10px each side
    ctx.fillStyle = "#10b981"; // green-500
    ctx.fillRect(badgeX, badgeY, textWidth + badgePadding, 40);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(badgeText, badgeX + (textWidth + badgePadding) / 2, 316);

    // Guests Allowed info - EXACT match
    ctx.font = "22px Arial, sans-serif";
    ctx.fillStyle = "#0d9488"; // teal-600
    ctx.textAlign = "left";
    ctx.fillText(`Guests Allowed: ${maxGuestsPerResident}`, 40, 360);

    // Add QR Code - EXACT match
    const qrCanvas = document.getElementById(
      `qr-${resident.id}`,
    ) as HTMLCanvasElement;
    if (qrCanvas) {
      // Draw QR code on right side with white background
      const qrSize = 250;
      const qrX = cardWidth - qrSize - 60;
      const qrY = 110;

      // White background for QR
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);

      // Draw QR code
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    }

    // Footer text - EXACT match
    ctx.fillStyle = "#64748b"; // gray-500
    ctx.font = "16px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scan this QR code at the pool entrance", cardWidth / 2, cardHeight - 40);
    ctx.fillText("Valid for current resident only • Non-transferable", cardWidth / 2, cardHeight - 15);

    // Download the professional card
    const url = idCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${resident.name.replace(/\s+/g, "-")}-Pool-Access-Card.png`;
    link.href = url;
    link.click();
  };

  // V7: Share resident pass via email
  const sharePassViaEmail = (resident: ProfileWithRules) => {
    const subject = encodeURIComponent(
      `Your Pool Access Pass - ${resident.name}`,
    );
    const body = encodeURIComponent(
      `Hi ${resident.name},\n\n` +
        `Your pool access pass is ready!\n\n` +
        `Resident: ${resident.name}\n` +
        `Unit: ${resident.unit}\n` +
        `Email: ${resident.email}\n\n` +
        `Please download your full access card from the resident portal at:\n` +
        `${window.location.origin}/resident\n\n` +
        `Your QR code: ${resident.qr_code}\n\n` +
        `Best regards,\n` +
        `Pool Management`,
    );
    window.location.href = `mailto:${resident.email}?subject=${subject}&body=${body}`;
  };

  // V7: Share resident pass via SMS
  const sharePassViaSMS = (resident: ProfileWithRules) => {
    if (!resident.phone) {
      alert("This resident does not have a phone number on file.");
      return;
    }
    const message = encodeURIComponent(
      `Hi ${resident.name}! Your pool access pass is ready. ` +
        `Visit ${window.location.origin}/resident to download your full access card. ` +
        `QR Code: ${resident.qr_code}`,
    );
    window.location.href = `sms:${resident.phone}?body=${message}`;
  };

  // V10.8.2: Show property selection prompt if no property is selected
  if (noPropertySelected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-navy-200">
          <div className="bg-teal-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold text-navy-900 mb-3">
            Select a Property
          </h2>
          <p className="text-navy-600 mb-6">
            Please select a property from your portfolio to view the dashboard and manage residents.
          </p>
          <Link
            href="/dashboard/portfolio"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Building2 className="w-5 h-5" />
            Go to Portfolio
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-navy-600 animate-spin mx-auto mb-4" />
          <p className="text-navy-600 font-semibold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100">
      {/* V10.8.6: Header moved to layout.tsx - single unified nav bar */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* V10.7: Mobile dropdown - 850px breakpoint for better responsiveness */}
          <select
            value={activeTab}
            onChange={(e) => {
              if (e.target.value === 'logs') {
                // V10.8.52: Fix mobile navigation 404 - correct path
                window.location.href = '/dashboard/logs';
              } else {
                setActiveTab(e.target.value as any);
              }
            }}
            className="block max-[850px]:block min-[850px]:hidden w-full p-2 my-2 border border-white/30 rounded-lg bg-navy-800/50 text-white font-semibold focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="overview" className="bg-navy-800 text-white">📊 Overview</option>
            <option value="residents" className="bg-navy-800 text-white">👥 Residents ({stats.totalResidents})</option>
            <option value="rules" className="bg-navy-800 text-white">🛡️ Access Rules ({stats.activeRules})</option>
            <option value="settings" className="bg-navy-800 text-white">⚙️ Facility Settings</option>
            <option value="revenue" className="bg-navy-800 text-white">💰 Revenue Analytics</option>
            <option value="occupancy" className="bg-navy-800 text-white">📈 Current Occupancy ({stats.currentOccupancy})</option>
            <option value="logs" className="bg-navy-800 text-white">🕐 All Activity</option>
          </select>

          {/* V10.7: Horizontal tabs - 850px breakpoint, centered, no overflow */}
          <div className="hidden max-[850px]:hidden min-[850px]:flex gap-1 whitespace-nowrap pb-2 justify-center mx-auto">
            <button
              onClick={() => setActiveTab("overview")}
              className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-teal-400 text-white bg-white/10"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab("residents")}
              className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "residents"
                  ? "border-teal-400 text-white bg-white/10"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Residents ({stats.totalResidents})
              </div>
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "rules"
                  ? "border-teal-400 text-white bg-white/10"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                Access Rules ({stats.activeRules})
              </div>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-teal-400 text-white bg-white/10"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                Facility Settings
              </div>
            </button>
            <button
              onClick={() => setActiveTab("revenue")}
              className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "revenue"
                  ? "border-teal-400 text-white bg-white/10"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Revenue Analytics
              </div>
            </button>
            <button
              onClick={() => setActiveTab("occupancy")}
              className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "occupancy"
                  ? "border-teal-400 text-white bg-white/10"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Current Occupancy ({stats.currentOccupancy})
              </div>
            </button>
            <Link
              href="/dashboard/logs"
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                All Activity
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* V8.10 Fix #3: Updated grid to fit all 4 cards in one row on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* V7.1: Total Residents - Clickable */}
              {/* V10.8.26: Refactored with flex-col and justify-start for perfect top alignment */}
              <button
                onClick={() => setActiveTab("residents")}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-blue-500 hover:shadow-xl transition-all text-left w-full cursor-pointer flex flex-col h-full"
              >
                <div className="flex items-start justify-between w-full mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">
                    {stats.totalResidents}
                  </span>
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-navy-900 mb-2">
                    Total Residents
                  </h3>
                  <p className="text-sm text-navy-600">
                    Active residents in the system
                  </p>
                  <p className="text-xs text-blue-600 font-semibold mt-2">
                    View all residents →
                  </p>
                </div>
              </button>

              {/* V7.1: Current Occupancy - Goes to Occupancy tab */}
              {/* V10.8.26: Refactored with flex-col and justify-start for perfect top alignment */}
              <button
                onClick={() => setActiveTab("occupancy")}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-teal-500 hover:shadow-xl transition-all text-left w-full cursor-pointer flex flex-col h-full"
              >
                <div className="flex items-start justify-between w-full mb-4">
                  <div className="bg-teal-100 p-3 rounded-lg">
                    <Activity className="w-6 h-6 text-teal-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">
                    {stats.currentOccupancy}
                  </span>
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-navy-900 mb-2">
                    Current Occupancy
                  </h3>
                  {stats.occupancyBreakdown && (
                    <div className="text-sm text-navy-600 space-y-1 mb-2">
                      <div>
                        Residents:{" "}
                        <span className="font-semibold">
                          {stats.occupancyBreakdown.residents}
                        </span>
                      </div>
                      <div>
                        Accompanying Guests:{" "}
                        <span className="font-semibold">
                          {stats.occupancyBreakdown.accompanying_guests}
                        </span>
                      </div>
                      <div>
                        Visitor Passes:{" "}
                        <span className="font-semibold">
                          {stats.occupancyBreakdown.visitor_passes}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-teal-600 font-semibold mt-2">
                    View detailed occupancy →
                  </p>
                </div>
              </button>

              {/* V7.1: Active Rules - Clickable */}
              {/* V10.8.26: Refactored with flex-col and justify-start for perfect top alignment */}
              <button
                onClick={() => setActiveTab("rules")}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-purple-500 hover:shadow-xl transition-all text-left w-full cursor-pointer flex flex-col h-full"
              >
                <div className="flex items-start justify-between w-full mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">
                    {stats.activeRules}
                  </span>
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-navy-900 mb-2">
                    Active Rules
                  </h3>
                  <p className="text-sm text-navy-600">
                    Access control rules in effect
                  </p>
                  <p className="text-xs text-purple-600 font-semibold mt-2">
                    Manage rules →
                  </p>
                </div>
              </button>

              {/* V10.8.28: Reverted to Today's Revenue on Overview tab */}
              {/* V10.8.26: Refactored with flex-col and justify-start for perfect top alignment */}
              <button
                onClick={() => {
                  setActiveTab("revenue");
                }}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-green-500 hover:shadow-xl transition-all text-left w-full cursor-pointer flex flex-col h-full"
              >
                <div className="flex items-start justify-between w-full mb-4">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  {revenueLoading ? (
                    <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                  ) : revenueData?.todayRevenue !== undefined && revenueData.todayRevenue > 0 ? (
                    <span className="text-3xl font-bold text-green-600">
                      ${revenueData.todayRevenue.toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-3xl font-bold text-gray-400">$0</span>
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold text-navy-900 mb-2">
                    Today's Revenue
                  </h3>
                  <p className="text-sm text-navy-600">
                    {revenueLoading
                      ? "Loading..."
                      : revenueData?.todayPasses !== undefined && revenueData.todayPasses > 0
                        ? `${revenueData.todayPasses} passes sold`
                        : "No sales yet"}
                  </p>
                  <p className="text-xs text-green-600 font-semibold mt-2">
                    View full analytics →
                  </p>
                </div>
              </button>
            </div>

            {/* Maintenance Mode Quick Toggle */}
            <div
              className={`rounded-xl shadow-lg p-6 border-2 transition-all ${
                isMaintenanceMode
                  ? "bg-red-50 border-red-300"
                  : "bg-green-50 border-green-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      isMaintenanceMode ? "bg-red-100" : "bg-green-100"
                    }`}
                  >
                    <Shield
                      className={`w-6 h-6 ${
                        isMaintenanceMode ? "text-red-600" : "text-green-600"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-navy-900 mb-1">
                      Pool Status: {isMaintenanceMode ? "CLOSED" : "OPEN"}
                    </h3>
                    <p className="text-sm text-navy-600">
                      {isMaintenanceMode
                        ? "Maintenance mode active - All access denied"
                        : "Operating normally - Access granted per rules"}
                    </p>
                  </div>
                </div>

                {/* V6: Fixed-width OPEN/CLOSED toggle */}
                <button
                  onClick={toggleMaintenanceMode}
                  disabled={togglingMaintenance}
                  className={`relative inline-flex h-12 w-36 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 shadow-md ${
                    !isMaintenanceMode
                      ? "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-400"
                      : "bg-rose-500 hover:bg-rose-600 focus:ring-rose-400"
                  }`}
                  role="switch"
                  aria-checked={!isMaintenanceMode}
                  title={
                    isMaintenanceMode
                      ? "Click to open pool"
                      : "Click to close pool"
                  }
                >
                  {/* Text: OPEN (left side, visible when open) */}
                  <span
                    className={`absolute left-4 text-sm font-bold text-white z-10 ${
                      !isMaintenanceMode ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    OPEN
                  </span>

                  {/* Text: CLOSED (right side, visible when closed) */}
                  <span
                    className={`absolute right-4 text-sm font-bold text-white z-10 ${
                      isMaintenanceMode ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    CLOSED
                  </span>

                  {/* Sliding Knob - RIGHT when OPEN, LEFT when CLOSED */}
                  <span
                    className={`relative inline-block h-10 w-10 rounded-full bg-white shadow-lg transition-transform duration-200 ${
                      !isMaintenanceMode ? "translate-x-24" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* V6: Broadcast Health Alert */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-1">
                    Health & Safety Alerts
                  </h3>
                  <p className="text-sm text-navy-600">
                    Send instant notifications to targeted resident groups.
                  </p>
                </div>
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <AlertCircle className="w-5 h-5" />
                  Broadcast Alert
                </button>
              </div>
            </div>

            {/* V8.12 UX #4: Recent Activity (Export button moved to Full Logs page) */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-6 h-6 text-navy-600" />
                <h2 className="text-2xl font-bold text-navy-900">
                  Recent Activity
                </h2>
              </div>

              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-navy-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-semibold">No activity yet</p>
                  <p className="text-sm">
                    Access logs will appear here once scanning begins
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((log, idx) => {
                    // V8.4 Fix #2: Detect visitor pass scans
                    const isVisitorPass =
                      log.qr_code?.startsWith("GUEST-") ||
                      log.qr_code?.startsWith("VISITOR-");
                    // V7.8 Feature #3: Handle STATUS_CHANGE and V7.5: Handle SYSTEM_BROADCAST
                    const isSystemBroadcast =
                      log.qr_code === "SYSTEM_BROADCAST" ||
                      (!log.user && log.denial_reason?.includes("BROADCAST"));
                    const isStatusChange =
                      log.qr_code === "STATUS_CHANGE" ||
                      log.denial_reason?.includes("Status changed from");

                    // V7.1: Color code by event type
                    let bgColor = "bg-gray-50";
                    let borderColor = "border-gray-200";
                    let iconColor = "text-gray-600";

                    if (isStatusChange) {
                      // V7.8: Purple/indigo for status changes
                      bgColor = "bg-indigo-50";
                      borderColor = "border-indigo-200";
                      iconColor = "text-indigo-600";
                    } else if (isSystemBroadcast) {
                      bgColor = "bg-orange-50";
                      borderColor = "border-orange-200";
                      iconColor = "text-orange-600";
                    } else if (log.result === "DENIED") {
                      bgColor = "bg-red-50";
                      borderColor = "border-red-200";
                      iconColor = "text-red-600";
                    } else if (log.scan_type === "ENTRY") {
                      bgColor = "bg-green-50";
                      borderColor = "border-green-200";
                      iconColor = "text-green-600";
                    } else if (log.scan_type === "EXIT") {
                      bgColor = "bg-blue-50";
                      borderColor = "border-blue-200";
                      iconColor = "text-blue-600";
                    }

                    return (
                      <div
                        key={log.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${bgColor} ${borderColor}`}
                      >
                        <div className="flex items-center gap-4">
                          {isStatusChange ? (
                            <Shield className={`w-5 h-5 ${iconColor}`} />
                          ) : isSystemBroadcast ? (
                            <MessageSquare className={`w-5 h-5 ${iconColor}`} />
                          ) : log.scan_type === "ENTRY" ? (
                            <LogIn className={`w-5 h-5 ${iconColor}`} />
                          ) : (
                            <LogOut className={`w-5 h-5 ${iconColor}`} />
                          )}
                          <div>
                            <p className="font-semibold text-navy-900">
                              {isStatusChange
                                ? "Pool Status Change"
                                : isSystemBroadcast
                                  ? "System Broadcast"
                                  : isVisitorPass
                                    ? `Visitor Pass (Guest of ${log.user?.name || "Unknown"}) - Unit ${log.user?.unit || "N/A"}`
                                    : `${log.user?.name || "Unknown"} - Unit ${log.user?.unit || "N/A"}`}
                            </p>
                            <p className="text-sm text-navy-600">
                              {isStatusChange
                                ? log.denial_reason
                                : isSystemBroadcast
                                  ? `${log.guest_count || 0} recipients`
                                  : `${log.scan_type} • ${log.result}`}
                              {!isStatusChange &&
                                log.denial_reason &&
                                ` • ${log.denial_reason}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-navy-500">
                          {new Date(log.scanned_at).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* V8.1 Feature #3: View All Activity Button */}
              <div className="mt-6 text-center">
                <Link
                  href="/dashboard/logs"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium"
                >
                  <Clock className="w-5 h-5" />
                  <span>View All Activity</span>
                </Link>
              </div>
            </div>

            {/* V7.4: Quick Actions section removed per requirement #5 */}
          </div>
        )}

        {/* RESIDENTS TAB */}
        {activeTab === "residents" && (
          <div className="space-y-6">
            {/* V10.8.7: Polished Add Resident Form with labels and asterisks */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Resident
              </h2>
              <form
                onSubmit={addResident}
                className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4"
              >
                {/* Full Name */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-navy-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newResidentName}
                    onChange={(e) => setNewResidentName(e.target.value)}
                    required
                    className="px-3 py-2 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-navy-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={newResidentEmail}
                    onChange={(e) => setNewResidentEmail(e.target.value)}
                    required
                    className="px-3 py-2 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                  />
                </div>

                {/* Unit # */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-navy-700 mb-1.5">
                    Unit # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="A101"
                    value={newResidentUnit}
                    onChange={(e) => setNewResidentUnit(e.target.value)}
                    required
                    className="px-3 py-2 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-navy-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={newResidentPhone}
                    onChange={(e) => setNewResidentPhone(e.target.value)}
                    className="px-3 py-2 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                  />
                </div>

                {/* Guest Limit */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-navy-700 mb-1.5">
                    Guest Limit
                  </label>
                  <input
                    type="number"
                    placeholder={maxGuestsPerResident > 0 ? `${maxGuestsPerResident}` : "2"}
                    value={newResidentGuestLimit}
                    onChange={(e) => setNewResidentGuestLimit(e.target.value)}
                    min="0"
                    max="10"
                    className="px-3 py-2 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                    title={`Leave blank to use facility default (${maxGuestsPerResident})`}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex flex-col justify-end">
                  <button
                    type="submit"
                    disabled={isAddingResident}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                  >
                    {isAddingResident ? "Adding..." : "Add Resident"}
                  </button>
                </div>

                {/* CSV Uploader - Full Width on Mobile */}
                <div className="md:col-span-3 lg:col-span-6">
                  <CsvUploader onUploadComplete={loadData} propertyId={propertyId || ''} />
                </div>
              </form>
            </div>

            {/* V10.8.4: Bulk Send Invites Button */}
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-teal-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-navy-900 mb-1">Resident Onboarding</h3>
                  <p className="text-sm text-navy-600">Send welcome emails with portal links and PINs to all residents</p>
                </div>
                <button
                  onClick={sendBulkInvites}
                  disabled={bulkSendingInvites || residents.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {bulkSendingInvites ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Send All Invites ({residents.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Residents Table - V7.5 Issue #4: Sticky first column + scrollable */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-navy-200">
              <div className="overflow-x-auto max-h-[600px] relative">
                <table className="w-full">
                  <thead className="bg-navy-800 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold sticky left-0 bg-navy-800 z-20">
                        Resident
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-bold">
                        Unit
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-bold">
                        Location
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-bold">
                        Access PIN
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-bold">
                        Guest Limit
                      </th>
                      {rules.map((rule) => (
                        <th
                          key={rule.id}
                          className="px-4 py-2 text-center text-xs font-bold"
                        >
                          {rule.rule_name}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-center text-xs font-bold">
                        QR Code
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-bold">
                        Actions
                      </th>
                      {/* V10.8.6: Delete column */}
                      <th className="px-4 py-2 text-center text-xs font-bold">
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-200">
                    {residents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={rules.length + 7}
                          className="px-6 py-12 text-center"
                        >
                          <div className="text-navy-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-semibold mb-1">
                              No residents yet
                            </p>
                            <p className="text-sm">
                              Add your first resident using the form above.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      residents.map((resident, idx) => (
                        <tr
                          key={resident.id}
                          className={idx % 2 === 0 ? "bg-white" : "bg-navy-50"}
                        >
                          {/* V7.5 Issue #4: Sticky first column */}
                          {/* V10.8.9: High-density table - compact padding */}
                          <td
                            className={`px-4 py-1.5 sticky left-0 z-10 ${idx % 2 === 0 ? "bg-white" : "bg-navy-50"}`}
                          >
                            <div>
                              <div className="font-semibold text-navy-900 text-sm leading-tight">
                                {resident.name}
                              </div>
                              <div className="text-xs text-navy-600 leading-tight">
                                {resident.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-1.5 text-navy-700">
                              <Home className="w-3.5 h-3.5" />
                              <span className="font-medium text-sm">
                                {resident.unit}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-1.5">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                resident.current_location === "INSIDE"
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-navy-100 text-navy-800"
                              }`}
                            >
                              {resident.current_location}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono text-sm font-bold text-navy-900 bg-yellow-100 px-2 py-0.5 rounded">
                                {(resident as any).access_pin || "----"}
                              </span>
                              <button
                                onClick={() => regeneratePin(resident.id)}
                                className="text-teal-600 hover:text-teal-700 text-xs font-semibold underline"
                                title="Generate new PIN"
                              >
                                Regenerate
                              </button>
                            </div>
                          </td>
                          {/* V7.1: Personal Guest Limit */}
                          {/* V10.8.9: Compact select */}
                          <td className="px-4 py-1.5 text-center">
                            <select
                              value={
                                (resident as any).personal_guest_limit || ""
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                updatePersonalGuestLimit(
                                  resident.id,
                                  val === "" ? null : parseInt(val),
                                );
                              }}
                              className="px-2 py-1 border border-navy-300 rounded text-xs font-semibold text-navy-900 bg-white focus:ring-1 focus:ring-teal-500"
                            >
                              <option value="">
                                Default ({maxGuestsPerResident})
                              </option>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map(
                                (num) => (
                                  <option key={num} value={num}>
                                    {num}
                                  </option>
                                ),
                              )}
                            </select>
                          </td>
                          {rules.map((rule) => {
                            const status = getRuleStatus(resident, rule.id);
                            return (
                              <td
                                key={rule.id}
                                className="px-4 py-1.5 text-center"
                              >
                                {/* V5: Wide Pill Toggle - YES/NO Design */}
                                {/* V10.8.9: Compact toggle */}
                                <button
                                  onClick={() =>
                                    toggleRule(resident.id, rule.id, status)
                                  }
                                  className={`relative inline-flex h-7 w-16 items-center justify-between rounded-full transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 shadow-sm ${
                                    status
                                      ? "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-400"
                                      : "bg-rose-500 hover:bg-rose-600 focus:ring-rose-400"
                                  }`}
                                  role="switch"
                                  aria-checked={status}
                                  title={
                                    status
                                      ? "YES - Click to mark as NO"
                                      : "NO - Click to mark as YES"
                                  }
                                >
                                  {/* LEFT Text: YES (visible when TRUE) */}
                                  <span
                                    className={`absolute left-1.5 text-[10px] font-bold text-white transition-opacity duration-200 ${
                                      status ? "opacity-100" : "opacity-0"
                                    }`}
                                  >
                                    YES
                                  </span>

                                  {/* RIGHT Text: NO (visible when FALSE) */}
                                  <span
                                    className={`absolute right-2 text-[10px] font-bold text-white transition-opacity duration-200 ${
                                      !status ? "opacity-100" : "opacity-0"
                                    }`}
                                  >
                                    NO
                                  </span>

                                  {/* Sliding Knob */}
                                  <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                      status
                                        ? "translate-x-1"
                                        : "translate-x-9"
                                    }`}
                                  />
                                </button>
                              </td>
                            );
                          })}
                          {/* V10.8.7: Compact table buttons - no icons, single line */}
                          {/* V10.8.9: Ultra-compact buttons */}
                          <td className="px-4 py-1.5 text-center">
                            <button
                              onClick={() => setSelectedResident(resident)}
                              className="bg-navy-600 hover:bg-navy-700 text-white px-2 py-1 rounded text-xs font-medium shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                            >
                              View QR
                            </button>
                          </td>
                          
                          <td className="px-4 py-1.5 text-center">
                            <button
                              onClick={() => sendInviteEmail(resident.id)}
                              disabled={sendingInvites.has(resident.id) || sentInvites.has(resident.id)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-all shadow-sm hover:shadow-md whitespace-nowrap ${
                                sentInvites.has(resident.id)
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50'
                              }`}
                              title={sentInvites.has(resident.id) ? 'Invite already sent' : 'Send welcome email'}
                            >
                              {sendingInvites.has(resident.id) ? (
                                'Sending...'
                              ) : sentInvites.has(resident.id) ? (
                                'Sent ✓'
                              ) : (
                                'Send Invite'
                              )}
                            </button>
                          </td>

                          <td className="px-4 py-1.5 text-center">
                            <button
                              onClick={() => deleteResident(resident.id, resident.name)}
                              className="px-2 py-1 rounded text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                              title="Permanently delete resident"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ACCESS RULES TAB */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            {/* Add Rule Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Access Rule
              </h2>
              <form
                onSubmit={addRule}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <input
                  type="text"
                  placeholder="Rule Name (e.g., 'Rent Paid', 'Pet Deposit')"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={isAddingRule}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {isAddingRule ? "Adding..." : "Add Rule"}
                </button>
              </form>
            </div>

            {/* Rules List */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4">
                Active Access Rules
              </h2>
              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 bg-navy-50 rounded-lg border border-navy-200 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-teal-100 p-2 rounded-lg">
                        <Shield className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-navy-900">
                          {rule.rule_name}
                        </div>
                        <div className="text-sm text-navy-600">
                          Created{" "}
                          {new Date(rule.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        Active
                      </span>
                      {/* V7.5 Issue #7: Delete Rule Button */}
                      <button
                        onClick={() => deleteRule(rule.id, rule.rule_name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {rules.length === 0 && (
                  <div className="text-center py-8 text-navy-500">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-semibold mb-1">
                      No access rules configured
                    </p>
                    <p className="text-sm">
                      Add your first rule above to start managing access.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FACILITY SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-navy-200">
              <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-3">
                <Settings className="w-7 h-7 text-teal-600" />
                Facility Settings
              </h2>

              <form onSubmit={saveFacilitySettings} className="space-y-6">
                {/* Property Name */}
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-2">
                    Property Name
                  </label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                    placeholder="My Pool"
                    required
                  />
                </div>

                {/* Operating Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-navy-900 mb-2">
                      Opening Time
                    </label>
                    <input
                      type="time"
                      value={operatingHoursStart}
                      onChange={(e) => setOperatingHoursStart(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy-900 mb-2">
                      Closing Time
                    </label>
                    <input
                      type="time"
                      value={operatingHoursEnd}
                      onChange={(e) => setOperatingHoursEnd(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                      required
                    />
                  </div>
                </div>

                {/* Max Capacity */}
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-2">
                    Maximum Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900 placeholder-gray-500"
                    placeholder="50"
                    required
                  />
                </div>

                {/* Guest Pass Price */}
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-2">
                    Visitor Pass Price (Daily Pass)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-600 font-bold text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={guestPassPrice}
                      onChange={(e) =>
                        setGuestPassPrice(parseFloat(e.target.value))
                      }
                      className="w-full pl-10 pr-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900 placeholder-gray-500"
                      placeholder="5.00"
                      required
                    />
                  </div>
                </div>

                {/* Max Guests Per Resident */}
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-2">
                    Default Guests Per Resident
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxGuestsPerResident}
                    onChange={(e) =>
                      setMaxGuestsPerResident(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white text-gray-900 placeholder-gray-500"
                    placeholder="3"
                    required
                  />
                  <p className="text-xs text-navy-500 mt-1">
                    Default number of accompanying guests allowed per resident visit
                  </p>
                </div>

                {/* V7.1: Max Visitor Passes */}
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-2">
                    Maximum Visitor Passes Allowed
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxVisitorPasses}
                    onChange={(e) =>
                      setMaxVisitorPasses(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="10"
                    required
                  />
                  <p className="text-xs text-navy-500 mt-1">
                    Total number of concurrent visitor passes (daily paid passes) allowed
                  </p>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-lg font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Settings className="w-5 h-5" />
                      Save Settings
                    </>
                  )}
                </button>
              </form>
              
              {/* V10.0: Generate Gate Sign Button */}
              <div className="mt-6 pt-6 border-t border-navy-200">
                <h3 className="text-lg font-semibold text-navy-900 mb-3">Self-Check-In System</h3>
                <p className="text-sm text-navy-600 mb-4">
                  Generate a QR code for your gate entrance. Residents and visitors can scan this code to check in/out.
                </p>
                <button
                  type="button"
                  onClick={generateGateSign}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <QrCode className="w-5 h-5" />
                  Generate Gate Sign
                </button>
              </div>

              {/* V10.6: Stripe Connect Payment Integration */}
              <div className="mt-6 pt-6 border-t border-navy-200">
                <h3 className="text-lg font-semibold text-navy-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-teal-600" />
                  Payment Integration
                </h3>
                <p className="text-sm text-navy-600 mb-4">
                  Connect your Stripe account to accept visitor pass payments. Demo Mode is active for testing.
                </p>
                
                {stripeConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-900">Stripe Connected (Demo Mode)</p>
                        <p className="text-xs text-green-700 mt-1">Account: {stripeAccountId}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={disconnectStripeAccount}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                      Disconnect Stripe
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={connectStripeAccount}
                    disabled={connectingStripe}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectingStripe ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        Connect with Stripe (Demo)
                      </>
                    )}
                  </button>
                )}
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Demo Mode:</strong> Test payments with card <code className="bg-blue-100 px-1 rounded">4242 4242 4242 4242</code>. No real charges will be made.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REVENUE ANALYTICS TAB */}
        {activeTab === "revenue" && (
          <div className="space-y-6">
            {revenueLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-navy-600 animate-spin mx-auto mb-4" />
                <p className="text-navy-600 font-semibold">
                  Loading revenue data...
                </p>
              </div>
            ) : revenueData ? (
              <>
                {/* V8.9 Fix #1: The Core 4 - Reordered summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* 1. Today */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-teal-400 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="w-6 h-6 text-teal-600" />
                      <span className="text-2xl font-bold text-teal-600">
                        ${revenueData.todayRevenue?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Today
                    </h3>
                    <p className="text-xs text-navy-600">
                      {revenueData.todayPasses || 0} {revenueData.todayPasses === 1 ? 'pass' : 'passes'} sold
                    </p>
                  </div>

                  {/* 2. Last 7 Days */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-blue-400 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <Clock className="w-6 h-6 text-blue-600" />
                      <span className="text-2xl font-bold text-blue-600">
                        ${revenueData.summary.last7Days.revenue.toFixed(2)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Last 7 Days
                    </h3>
                    <p className="text-xs text-navy-600">
                      {revenueData.summary.last7Days.count} passes
                    </p>
                  </div>

                  {/* 3. This Month */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-purple-400 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                      <span className="text-2xl font-bold text-purple-600">
                        ${revenueData.summary.currentMonth.revenue.toFixed(2)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      This Month
                    </h3>
                    <p className="text-xs text-navy-600">
                      {revenueData.summary.currentMonth.count} passes
                    </p>
                  </div>

                  {/* 4. Visitor Passes - V10.8.32: Context labels verified */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-green-400 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <QrCode className="w-6 h-6 text-green-600" />
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600 block">
                          {revenueData?.checkedInCount || 0}
                        </span>
                        <span className="text-xs text-green-600 font-semibold">
                          Currently Checked-In
                        </span>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Visitor Passes
                    </h3>
                    <p className="text-xs text-navy-600">
                      {revenueData?.unusedCount || 0} unused passes available
                    </p>
                  </div>
                </div>

                {/* V9.2 Feature #2: Recharts - Daily Revenue */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                  <h3 className="text-xl font-bold text-navy-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-teal-600" />
                    Daily Revenue (Last 7 Days)
                  </h3>
                  {(() => {
                    const last7 = revenueData.charts.daily.slice(-7).map((d: any) => ({
                      ...d,
                      dateLabel: d.date.split('-').slice(1).join('/') // Format as MM/DD
                    }))
                    // V9.2 Feature #2: Use Recharts for professional, responsive chart
                    return (
                      <div className="w-full h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={last7} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="dateLabel" 
                              tick={{ fontSize: 12, fill: '#475569' }}
                              stroke="#cbd5e1"
                            />
                            <YAxis 
                              tick={{ fontSize: 12, fill: '#475569' }}
                              tickFormatter={(value) => `$${value}`}
                              stroke="#cbd5e1"
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '8px 12px'
                              }}
                              formatter={(value: any) => [`$${value.toFixed(2)}`, 'Revenue']}
                              labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="#14b8a6" 
                              strokeWidth={2}
                              fill="url(#colorRevenue)" 
                              dot={{ r: 4, fill: '#fff', stroke: '#14b8a6', strokeWidth: 2 }}
                              activeDot={{ r: 6 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}
                </div>

                {/* V9.2 Feature #2: Recharts - Monthly Revenue */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                  <h3 className="text-xl font-bold text-navy-900 mb-6 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                    Monthly Revenue Trend
                  </h3>
                  {(() => {
                    // V9.3 Fix #3: Apply Recharts to Monthly Revenue
                    const last6 = revenueData.charts.monthly.slice(-6).map((m: any) => ({
                      ...m,
                      monthLabel: m.month.split(' ')[0].substring(0, 3) // Format as 3-letter month
                    }))
                    
                    return (
                      <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={last6} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="monthLabel" 
                              tick={{ fontSize: 12, fill: '#475569' }}
                              stroke="#cbd5e1"
                            />
                            <YAxis 
                              tick={{ fontSize: 12, fill: '#475569' }}
                              tickFormatter={(value) => `$${value}`}
                              stroke="#cbd5e1"
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '8px 12px'
                              }}
                              formatter={(value: any) => [`$${value.toFixed(2)}`, 'Revenue']}
                              labelFormatter={(label) => `Month: ${label}`}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="#a855f7" 
                              strokeWidth={2}
                              fill="url(#colorMonthly)" 
                              dot={{ r: 4, fill: '#fff', stroke: '#a855f7', strokeWidth: 2 }}
                              activeDot={{ r: 6 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}
                </div>

                {/* V8.11 Feature #4: Enhanced Revenue Footer with Date Filter & CSV Export */}
                <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 rounded-xl shadow-2xl p-8 border-2 border-teal-500">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <select
                        value={revenueFilter}
                        onChange={(e) => setRevenueFilter(e.target.value as any)}
                        className="bg-white/10 text-white border border-teal-400 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-colors"
                      >
                        <option value="all" className="bg-navy-900">All-Time</option>
                        <option value="year" className="bg-navy-900">This Year</option>
                        <option value="month" className="bg-navy-900">This Month</option>
                        <option value="week" className="bg-navy-900">Last 7 Days</option>
                      </select>
                      <button
                        onClick={() => setShowRevenueExportModal(true)}
                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export Detailed CSV
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-300 text-sm font-semibold mb-2">
                        {revenueFilter === 'all' ? 'ALL-TIME' : 
                         revenueFilter === 'year' ? 'THIS YEAR' :
                         revenueFilter === 'month' ? 'THIS MONTH' : 'LAST 7 DAYS'} TOTAL
                      </p>
                      <h2 className="text-5xl font-bold text-white mb-2">
                        ${getFilteredRevenue().revenue.toFixed(2)}
                      </h2>
                      <p className="text-teal-200 text-sm">
                        {getFilteredRevenue().passes} passes sold
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                      <DollarSign className="w-16 h-16 text-teal-400" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* V7.5 Issue #1: Show placeholder data with 0 values instead of blank state */
              <>
                {/* V8.9: Placeholder Cards - The Core 4 (Empty State) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* 1. Today */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="w-6 h-6 text-teal-600" />
                      <span className="text-2xl font-bold text-gray-400">
                        $0.00
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Today
                    </h3>
                    <p className="text-xs text-navy-600">0 passes sold</p>
                  </div>

                  {/* 2. Last 7 Days */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                    <div className="flex items-center justify-between mb-2">
                      <Clock className="w-6 h-6 text-blue-600" />
                      <span className="text-2xl font-bold text-gray-400">
                        $0.00
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Last 7 Days
                    </h3>
                    <p className="text-xs text-navy-600">0 passes</p>
                  </div>

                  {/* 3. This Month */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                      <span className="text-2xl font-bold text-gray-400">
                        $0.00
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      This Month
                    </h3>
                    <p className="text-xs text-navy-600">0 passes</p>
                  </div>

                  {/* 4. Active Passes */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-6 h-6 text-green-600" />
                      <span className="text-2xl font-bold text-gray-400">
                        0
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Active Passes
                    </h3>
                    <p className="text-xs text-navy-600">Currently valid</p>
                  </div>
                </div>

                {/* Daily Revenue Chart - Empty */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                  <h3 className="text-xl font-bold text-navy-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-teal-600" />
                    Daily Revenue (Last 7 Days)
                  </h3>
                  <div className="text-center py-12 text-navy-500">
                    <div className="bg-teal-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-10 h-10 text-teal-400" />
                    </div>
                    <p className="text-sm font-medium">
                      No sales data yet
                    </p>
                    <p className="text-xs mt-2">
                      Daily revenue chart will appear once guest passes are purchased
                    </p>
                  </div>
                </div>

                {/* Monthly Revenue - Empty */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                  <h3 className="text-xl font-bold text-navy-900 mb-6 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                    Monthly Revenue Trend
                  </h3>
                  <div className="text-center py-12 text-navy-500">
                    <div className="bg-purple-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-10 h-10 text-purple-400" />
                    </div>
                    <p className="text-sm font-medium">
                      No monthly data yet
                    </p>
                    <p className="text-xs mt-2">
                      Monthly trends will appear once guest passes are purchased
                    </p>
                  </div>
                </div>

                {/* Total Revenue Footer - Empty State */}
                <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 rounded-xl shadow-2xl p-8 border-2 border-teal-500/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-300 text-sm font-semibold mb-2">ALL-TIME TOTAL</p>
                      <h2 className="text-5xl font-bold text-white mb-2">
                        $0.00
                      </h2>
                      <p className="text-teal-200 text-sm">
                        0 passes sold
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                      <DollarSign className="w-16 h-16 text-teal-400/50" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* V7.2: New Current Occupancy Tab */}
        {activeTab === "occupancy" && (
          <div className="space-y-6">
            {/* Occupancy Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-teal-600" />
                <h2 className="text-2xl font-bold text-navy-900">
                  Current Occupancy
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* V7.4 Issue #6: Dynamic calculation from insideResidents */}
                {(() => {
                  const residentCount = insideResidents.length;
                  const guestCount = insideResidents.reduce(
                    (sum, r) => sum + (r.active_guests || 0),
                    0,
                  );
                  const visitorPasses =
                    stats.occupancyBreakdown?.visitor_passes || 0;
                  const totalOccupancy =
                    residentCount + guestCount + visitorPasses;

                  return (
                    <>
                      <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-lg p-4 border-2 border-teal-200">
                        <p className="text-sm font-semibold text-navy-600 mb-1">
                          Total
                        </p>
                        <p className="text-3xl font-bold text-teal-600">
                          {totalOccupancy}
                        </p>
                        <p className="text-xs text-navy-500 mt-1">
                          People inside
                        </p>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm font-semibold text-navy-600 mb-1">
                          Residents
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          {residentCount}
                        </p>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <p className="text-sm font-semibold text-navy-600 mb-1">
                          Guests
                        </p>
                        <p className="text-2xl font-bold text-purple-600">
                          {guestCount}
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm font-semibold text-navy-600 mb-1">
                          Visitor Passes
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          {visitorPasses}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={loadInsideResidents}
                  disabled={loadingInsideResidents}
                  className="flex-1 bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingInsideResidents ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      Refresh
                    </>
                  )}
                </button>
                <button
                  onClick={clearAllOccupants}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Clear All Occupants
                </button>
              </div>
            </div>

            {/* People Inside Table */}
            <div className="bg-white rounded-xl shadow-lg border border-navy-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-navy-700 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  People Currently Inside
                </h3>
              </div>

              {insideResidents.length === 0 ? (
                <div className="text-center py-12 text-navy-500">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold mb-2">
                    No one is currently inside
                  </p>
                  <p className="text-sm">The facility is empty</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-navy-50 border-b border-navy-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Resident
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Unit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Entry Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Guests
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {insideResidents.map((resident) => (
                        <tr
                          key={resident.id}
                          className="hover:bg-teal-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="font-semibold text-navy-900">
                                {resident.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-navy-600">
                            {resident.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                            {resident.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-600">
                            {resident.last_scan_at
                              ? new Date(resident.last_scan_at).toLocaleString()
                              : "Unknown"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                                (resident.active_guests || 0) > 0
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              <Users className="w-4 h-4" />
                              {resident.active_guests || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700">
                              {1 + (resident.active_guests || 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleForceCheckout(resident.id)}
                              className="text-red-600 hover:text-red-800 font-semibold text-sm flex items-center gap-1 hover:underline"
                            >
                              <LogOut className="w-4 h-4" />
                              Force Exit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* V9.4 Feature #1: Hourly Occupancy Trend Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-green-600" />
                  <h2 className="text-2xl font-bold text-navy-900">
                    Hourly Occupancy Trend
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={trendDate}
                    onChange={(e) => setTrendDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-4 py-2 border border-navy-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export Data
                  </button>
                </div>
              </div>

              {loadingTrend ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
              ) : trendData.length === 0 ? (
                <div className="text-center py-12 text-navy-500">
                  <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold mb-2">No data available</p>
                  <p className="text-sm">Select a date with activity to view trends</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trendData} onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedHour(data.activeLabel);
                        loadPeopleAtHour(data.activeLabel);
                      }
                    }}>
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="hour" 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'People Inside', angle: -90, position: 'insideLeft' }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                        formatter={(value: any) => [`${value} people`, 'Occupancy']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="occupancy" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fill="url(#trendGradient)"
                        cursor="pointer"
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Show people at selected hour */}
                  {selectedHour && (
                    <div className="mt-6 border-t border-navy-200 pt-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4">
                        People Inside at {selectedHour}
                      </h3>
                      {hourlyPeople.length === 0 ? (
                        <p className="text-navy-500 text-center py-4">No entries found for this hour</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-navy-50 border-b border-navy-200">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-navy-700 uppercase">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-navy-700 uppercase">Unit</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-navy-700 uppercase">Guests</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-navy-700 uppercase">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-navy-100">
                              {hourlyPeople.map((person, idx) => (
                                <tr key={idx} className="hover:bg-green-50 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-navy-900">{person.name}</td>
                                  <td className="px-4 py-3 text-navy-600">{person.unit}</td>
                                  <td className="px-4 py-3 text-navy-600">{person.guests}</td>
                                  <td className="px-4 py-3 font-bold text-green-600">{person.totalPeople}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {/* V7.2: Leftover modal removed - use Occupancy tab instead */}

      {/* V7: Enhanced QR Code Modal with Full ID Card and Sharing */}
      {selectedResident && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedResident(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-navy-900">
                  {selectedResident.name}
                </h3>
                <p className="text-navy-600">
                  Unit {selectedResident.unit} • {selectedResident.email}
                </p>
              </div>
              <button
                onClick={() => setSelectedResident(null)}
                className="text-navy-400 hover:text-navy-600 transition-colors"
              >
                <XCircle className="w-8 h-8" />
              </button>
            </div>

            {/* QR Code Display */}
            <div className="bg-gradient-to-br from-navy-900 to-teal-700 p-6 rounded-xl mb-6">
              <div className="bg-white p-6 rounded-lg mx-auto w-fit">
                <QRCodeCanvas
                  id={`qr-${selectedResident.id}`}
                  value={selectedResident.qr_code}
                  size={280}
                  level="H"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-center text-white text-sm mt-4 font-medium">
                Scan at pool entrance • Non-transferable
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => downloadFullIDCard(selectedResident)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Full Pass Card
              </button>
              <button
                onClick={() => sharePassViaEmail(selectedResident)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Email Pass
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => sharePassViaSMS(selectedResident)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Text Pass Link
              </button>
              <button
                onClick={() => setSelectedResident(null)}
                className="bg-navy-200 hover:bg-navy-300 text-navy-900 px-6 py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-navy-500 text-center mt-4">
              💡 Tip: The full pass card includes resident name, unit, QR code,
              and guest allowance
            </p>
          </div>
        </div>
      )}

      {/* V6: Broadcast Alert Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-7 h-7 text-red-600" />
              Broadcast Health Alert
            </h2>
            {/* V7.7 Fix #3: Updated description for historical & facility-wide reach */}
            <p className="text-navy-600 mb-6">
              Send urgent notifications to residents based on visit history or
              facility-wide
            </p>

            {/* Target Filter Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Target Audience
              </label>
              <select
                value={broadcastTargetFilter}
                onChange={(e) =>
                  setBroadcastTargetFilter(
                    e.target.value as "INSIDE" | "ALL" | "RECENT" | "DATE",
                  )
                }
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900"
              >
                <option value="INSIDE" className="bg-white text-gray-900">
                  Currently Inside Only
                </option>
                <option value="RECENT" className="bg-white text-gray-900">
                  Visited in Last 4 Hours
                </option>
                <option value="ALL" className="bg-white text-gray-900">
                  All Active Residents
                </option>
                <option value="DATE" className="bg-white text-gray-900">
                  Present on Specific Date
                </option>
              </select>
              <p className="text-xs text-navy-500 mt-1">
                {broadcastTargetFilter === "INSIDE" &&
                  "Send to residents currently at the facility"}
                {broadcastTargetFilter === "RECENT" &&
                  "Send to residents who visited within the last 4 hours"}
                {broadcastTargetFilter === "ALL" &&
                  "Send to all active residents regardless of location"}
                {broadcastTargetFilter === "DATE" &&
                  "Send to residents who were present on a specific date"}
              </p>
            </div>

            {/* V7.7 Fix #3: Date Selector for Historical Broadcasts */}
            {broadcastTargetFilter === "DATE" && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-navy-900 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={broadcastDate}
                  onChange={(e) => setBroadcastDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            )}

            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Enter your alert message (e.g., 'Severe weather approaching - please exit immediately')"
              className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-32 mb-6 bg-white text-gray-900 placeholder-gray-500"
            />

            <div className="flex gap-3">
              <button
                onClick={sendBroadcastAlert}
                disabled={sendingBroadcast || !broadcastMessage.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingBroadcast ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Send Alert
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage("");
                  setBroadcastTargetFilter("INSIDE");
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-navy-900 px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V9.9 Fix #4: Multi-Day CSV Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
              <Download className="w-7 h-7 text-green-600" />
              Export Multi-Day Trend Data
            </h2>
            <p className="text-navy-600 mb-6">
              Select a date range to export hourly occupancy data
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={exportMultiDayTrendCSV}
                disabled={isExporting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Export CSV
                  </>
                )}
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="px-6 py-3 border-2 border-navy-300 text-navy-700 rounded-lg font-semibold hover:bg-navy-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V10.0: Gate Sign Modal */}
      {showGateSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl print:rounded-none print:max-w-none print:shadow-none print:h-screen print:flex print:items-center print:justify-center">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2 print:hidden">
              <QrCode className="w-7 h-7 text-teal-600" />
              Gate Check-In Sign
            </h2>
            <p className="text-navy-600 mb-6 print:hidden">
              Display this QR code at your entrance gate. Residents and visitors can scan to check in/out.
            </p>

            {/* V10.2 Fix #1: Bulletproof Single-Page Print Layout with Logo */}
            <div className="print-container bg-navy-50 rounded-xl p-6 text-center print:bg-white print:rounded-none print:p-8">
              {/* V10.2 Fix #1: Branding Logo - Above property name */}
              <div className="mb-6 print:mb-8">
                <img 
                  src="/logo.png" 
                  alt="Secure Access Pass Logo" 
                  className="h-16 mx-auto object-contain print:h-24"
                  onError={(e) => {
                    // Fallback to Shield icon if logo not found
                    e.currentTarget.style.display = 'none'
                    const shieldFallback = document.getElementById('shield-fallback')
                    if (shieldFallback) shieldFallback.style.display = 'block'
                  }}
                />
                <div id="shield-fallback" className="hidden">
                  <Shield className="w-16 h-16 mx-auto text-teal-600 print:w-24 print:h-24" />
                </div>
              </div>

              {/* Property Name - Large and Bold */}
              <h1 className="text-2xl font-bold text-navy-900 mb-6 print:text-5xl print:mb-8">
                {propertyName || 'Secure Access Pass'}
              </h1>

              {/* QR Code - Large for distance scanning */}
              <div className="bg-white inline-block p-4 rounded-xl shadow-lg mb-6 print:shadow-none print:mb-8 print:p-6">
                {gateSignQRCode && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(gateSignQRCode)}`}
                    alt="Gate Check-In QR Code"
                    className="w-64 h-64 print:w-[350px] print:h-[350px]"
                  />
                )}
              </div>

              {/* Instructions */}
              <h3 className="text-xl font-bold text-navy-900 mb-2 print:text-4xl print:mb-4">
                Scan with your phone camera
              </h3>
              <p className="text-lg text-navy-600 print:text-3xl print:font-semibold">
                to Check In or Out
              </p>
            </div>

            <div className="flex gap-3 mt-6 print:hidden">
              <button
                onClick={printGateSign}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print Sign (8.5x11)
              </button>
              <button
                onClick={() => setShowGateSignModal(false)}
                className="px-6 py-3 border-2 border-navy-300 text-navy-700 rounded-lg font-semibold hover:bg-navy-50 transition-all"
              >
                Close
              </button>
            </div>

            {/* V10.2 Fix #1: Bulletproof Single-Page Print Styles */}
            <style jsx global>{`
              @page {
                size: letter;
                margin: 0;
              }
              
              @media print {
                /* Hide everything first */
                body * {
                  visibility: hidden !important;
                }
                
                /* Show only the print container and its children */
                .print-container,
                .print-container * {
                  visibility: visible !important;
                }
                
                /* Aggressive single-page enforcement */
                .print-container {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: 100vh !important;
                  overflow: hidden !important;
                  page-break-after: avoid !important;
                  page-break-before: avoid !important;
                  page-break-inside: avoid !important;
                  margin: 0 !important;
                  padding: 2rem !important;
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                  justify-content: center !important;
                  background: white !important;
                  box-sizing: border-box !important;
                }
                
                /* Force body constraints */
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: hidden !important;
                  height: 100vh !important;
                  width: 100vw !important;
                }
                
                html {
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: hidden !important;
                  height: 100vh !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* V10.8.25: Detailed Revenue Export Modal */}
      {showRevenueExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-navy-900">Export Detailed Revenue</h3>
              <button
                onClick={() => setShowRevenueExportModal(false)}
                className="text-navy-400 hover:text-navy-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-navy-900 mb-2">
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-900 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <p className="text-sm text-navy-600 bg-blue-50 p-3 rounded-lg">
                Leave dates blank to export all transactions. CSV will include: Date/Time, Resident Name, Unit, Passes Bought, Amount Paid.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRevenueExportModal(false)}
                className="flex-1 px-6 py-3 border border-navy-300 text-navy-700 rounded-lg font-semibold hover:bg-navy-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={exportDetailedRevenueCSV}
                disabled={exportingRevenue}
                className="flex-1 px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingRevenue ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// V10.8.9: Export with Suspense wrapper
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-navy-50 to-navy-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-navy-600 font-semibold">Loading Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}
