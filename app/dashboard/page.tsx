"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Trash2, // V7.5: For delete rule button
  Building2, // V9.0: Portfolio link
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

export default function DashboardPage() {
  const [residents, setResidents] = useState<ProfileWithRules[]>([]);
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalResidents: 0,
    currentOccupancy: 0,
    activeRules: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "residents" | "rules" | "settings" | "revenue" | "occupancy"
  >("overview");
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

  // V7: Revenue Analytics
  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  // V8.11 Feature #4: Revenue date filter
  const [revenueFilter, setRevenueFilter] = useState<'all' | 'year' | 'month' | 'week'>('all');

  useEffect(() => {
    loadData();
    loadMaintenanceStatus();
    loadOccupancyBreakdown(); // V6
    loadInsideResidents(); // V8.11 Fix #1: Load occupancy data on mount
    loadFacilitySettings(); // V7
    // V7.1: Load revenue after mount to avoid undefined function error
    loadRevenueData();
  }, []);

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

  const loadMaintenanceStatus = async () => {
    try {
      const response = await fetch("/api/settings");
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
    try {
      const response = await fetch("/api/occupancy");
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [residentsRes, rulesRes, statsRes] = await Promise.all([
        fetch("/api/residents"),
        fetch("/api/rules"),
        fetch("/api/stats"),
      ]);

      // Check if responses are OK
      if (!residentsRes.ok || !rulesRes.ok || !statsRes.ok) {
        console.error("API Error:", {
          residents: residentsRes.status,
          rules: rulesRes.status,
          stats: statsRes.status,
        });
        throw new Error("Failed to fetch data from API");
      }

      const residentsData = await residentsRes.json();
      const rulesData = await rulesRes.json();
      const statsData = await statsRes.json();

      // Ensure we always have arrays
      setResidents(Array.isArray(residentsData) ? residentsData : []);
      setRules(
        Array.isArray(rulesData)
          ? rulesData.filter((r: AccessRule) => r.is_active)
          : [],
      );
      setStats(statsData);
    } catch (error) {
      console.error("Error loading data:", error);
      setResidents([]);
      setRules([]);
      alert(
        "Failed to load data. Please check your Supabase connection and ensure the database schema is set up correctly.",
      );
    } finally {
      setLoading(false);
    }
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
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
  const sendBroadcastAlert = async () => {
    if (!broadcastMessage || broadcastMessage.trim() === "") {
      alert("Please enter a message");
      return;
    }

    setSendingBroadcast(true);
    try {
      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    if (!silent) {
      setLoadingInsideResidents(true);
    }
    try {
      // Use unified occupancy endpoint that includes visitors
      const response = await fetch("/api/occupancy-list");
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

  // V4: Regenerate PIN for resident
  const regeneratePin = async (residentId: string) => {
    if (!confirm("Generate a new 4-digit PIN for this resident?")) {
      return;
    }

    try {
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const response = await fetch("/api/residents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: residentId,
          access_pin: newPin,
        }),
      });

      if (!response.ok) throw new Error("Failed to regenerate PIN");

      alert(`New PIN generated: ${newPin}`);
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
      const response = await fetch(`/api/occupancy-trend?date=${date}`);
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

  // V9.8 Fix #4: Simplified drill-down logic with correct schema field checking
  const loadPeopleAtHour = async (hour: string) => {
    try {
      const response = await fetch(`/api/activity-logs?limit=5000&startDate=${trendDate}&endDate=${trendDate}`);
      if (!response.ok) throw new Error('Failed to load activity logs');
      const data = await response.json();
      
      // Parse clicked hour (e.g., "14:00" → 14)
      const hourNum = parseInt(hour.split(':')[0]);
      
      // Create hour boundaries using LOCAL date (match API's date string format)
      const [year, month, day] = trendDate.split('-').map(Number);
      const hourStart = new Date(year, month - 1, day, hourNum, 0, 0, 0);
      const hourEnd = new Date(year, month - 1, day, hourNum, 59, 59, 999);
      
      // Group logs by user to track entry/exit pairs
      const userLogs = new Map();
      (data.logs || []).forEach((log: any) => {
        // Skip invalid logs
        if (!log || !log.scanned_at) return;
        
        // Use user_id as primary key, fallback to qr_code for visitor passes
        const userId = log.user_id || log.qr_code || `unknown-${Math.random()}`;
        
        if (!userLogs.has(userId)) {
          // V9.9 Fix #3: Map Unknown/Visitor Pass names to "Visitor"
          let displayName = log.user?.name || 'Unknown';
          if (!log.user?.name || log.user?.name === 'Unknown' || log.qr_code?.startsWith('GUEST-') || log.qr_code?.startsWith('VISITOR-')) {
            displayName = 'Visitor';
          }
          
          userLogs.set(userId, { 
            entries: [], 
            exits: [], 
            name: displayName,
            unit: log.user?.unit || 'N/A',
            guestCount: log.guest_count || 0
          });
        }
        
        const userLog = userLogs.get(userId);
        const timestamp = new Date(log.scanned_at);
        
        // Check scan_type field (correct schema field from API)
        if (log.scan_type === 'ENTRY') {
          userLog.entries.push(timestamp);
          // Update guest count from most recent entry
          userLog.guestCount = log.guest_count || 0;
        } else if (log.scan_type === 'EXIT') {
          userLog.exits.push(timestamp);
        }
      });
      
      // Find people who were PRESENT during the clicked hour
      const peopleMap = new Map();
      
      userLogs.forEach((userLog, userId) => {
        // Find the last entry that occurred before or during the hour
        const relevantEntry = userLog.entries
          .filter((t: Date) => t <= hourEnd)
          .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
        
        if (!relevantEntry) return; // Never entered by this hour
        
        // Find the first exit that occurred after that entry
        const relevantExit = userLog.exits
          .filter((t: Date) => t >= relevantEntry)
          .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
        
        // Present if: entered before/during hour AND (no exit OR exited after hour started)
        const wasPresent = relevantEntry <= hourEnd && (!relevantExit || relevantExit >= hourStart);
        
        if (wasPresent) {
          const key = `${userLog.name}-${userLog.unit}`;
          peopleMap.set(key, {
            name: userLog.name,
            unit: userLog.unit,
            guests: userLog.guestCount,
            totalPeople: 1 + userLog.guestCount
          });
        }
      });
      
      setHourlyPeople(Array.from(peopleMap.values()));
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
        
        // Fetch trend data for this date
        const response = await fetch(`/api/occupancy-trend?date=${dateStr}`);
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
  const loadFacilitySettings = async (force = false) => {
    // Skip if already cached and not forcing reload
    if (settingsCached && !force) {
      return;
    }
    
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setPropertyName(data.property_name || "");
        setOperatingHoursStart(data.operating_hours_start || "06:00");
        setOperatingHoursEnd(data.operating_hours_end || "22:00");
        setMaxCapacity(data.max_capacity || 50);
        setGuestPassPrice(data.guest_pass_price || 5.0);
        setMaxGuestsPerResident(data.max_guests_per_resident || 3);
        setMaxVisitorPasses(data.max_visitor_passes || 100); // V7.2
        setSettingsCached(true); // Mark as cached
      }
    } catch (error) {
      console.error("Error loading facility settings:", error);
    }
  };

  // V7: Save Facility Settings
  const saveFacilitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // V7: Load Revenue Data
  const loadRevenueData = async () => {
    setRevenueLoading(true);
    try {
      const response = await fetch("/api/revenue");
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

    try {
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_name: newRuleName,
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

  // V7: Download full professional ID card (matching resident portal format)
  const downloadFullIDCard = (resident: ProfileWithRules) => {
    const idCanvas = document.createElement("canvas");
    const ctx = idCanvas.getContext("2d");
    if (!ctx) return;

    // Card dimensions (landscape professional card)
    const cardWidth = 1000;
    const cardHeight = 450;
    idCanvas.width = cardWidth;
    idCanvas.height = cardHeight;

    // Draw gradient background (navy to teal)
    const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
    gradient.addColorStop(0, "#1e3a8a"); // navy-900
    gradient.addColorStop(1, "#0d9488"); // teal-600
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Border
    ctx.strokeStyle = "#14b8a6"; // teal-500
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, cardWidth - 8, cardHeight - 8);

    // White shield icon background (top left)
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.arc(80, 80, 60, 0, 2 * Math.PI);
    ctx.fill();

    // Card title
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillStyle = "#14b8a6"; // teal-500
    ctx.textAlign = "left";
    ctx.fillText("Pool Access Pass", 40, 120);

    // Resident name
    ctx.font = "bold 42px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(resident.name, 40, 180);

    // Unit number
    ctx.font = "28px Arial, sans-serif";
    ctx.fillStyle = "#cbd5e1"; // gray-300
    ctx.fillText(`Unit ${resident.unit}`, 40, 220);

    // Email
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#94a3b8"; // gray-400
    ctx.fillText(resident.email, 40, 260);

    // Status badge
    ctx.fillStyle = "#10b981"; // green-500
    ctx.fillRect(40, 290, 180, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✓ VALID RESIDENT", 130, 316);

    // Guests Allowed info
    ctx.font = "22px Arial, sans-serif";
    ctx.fillStyle = "#0d9488"; // teal-600
    ctx.textAlign = "left";
    ctx.fillText(`Guests Allowed: ${maxGuestsPerResident}`, 40, 360);

    // Add QR Code
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

    // Footer text
    ctx.fillStyle = "#64748b"; // gray-500
    ctx.font = "16px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Scan this QR code at the pool entrance",
      cardWidth / 2,
      cardHeight - 40,
    );
    ctx.fillText(
      "Valid for current resident only • Non-transferable",
      cardWidth / 2,
      cardHeight - 15,
    );

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
      {/* V9.9 Fix #5: Consolidated Single Header with Navigation */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top row: Title and Action Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 sm:py-6">
            <div className="flex items-center gap-3">
              <div className="hidden sm:block bg-teal-500 p-3 rounded-xl">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Secure Access Pass</h1>
                <p className="hidden sm:block text-navy-200 text-sm">Manager Command Center</p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <a
                href="/"
                className="bg-white/20 hover:bg-white/30 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all text-sm"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </a>
              <a
                href="/scanner"
                className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all text-sm"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Scanner</span>
              </a>
              <a
                href="/dashboard/portfolio"
                className="bg-purple-500/90 hover:bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all text-sm"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Portfolio</span>
              </a>
            </div>
          </div>

          {/* Bottom row: Tab Navigation */}
          {/* V9.9 Fix #5: Mobile dropdown menu (now in header) */}
          <select
            value={activeTab}
            onChange={(e) => {
              if (e.target.value === 'logs') {
                window.location.href = '/logs';
              } else {
                setActiveTab(e.target.value as any);
              }
            }}
            className="block xl:hidden w-full p-2 my-2 border border-white/30 rounded-lg bg-navy-800/50 text-white font-semibold focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="overview" className="bg-navy-800 text-white">📊 Overview</option>
            <option value="residents" className="bg-navy-800 text-white">👥 Residents ({stats.totalResidents})</option>
            <option value="rules" className="bg-navy-800 text-white">🛡️ Access Rules ({stats.activeRules})</option>
            <option value="settings" className="bg-navy-800 text-white">⚙️ Facility Settings</option>
            <option value="revenue" className="bg-navy-800 text-white">💰 Revenue Analytics</option>
            <option value="occupancy" className="bg-navy-800 text-white">📈 Current Occupancy ({stats.currentOccupancy})</option>
            <option value="logs" className="bg-navy-800 text-white">🕐 All Activity</option>
          </select>

          {/* V9.9 Fix #5: Horizontal tabs (now in header with white/transparent styling) */}
          <div className="hidden xl:flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide pb-2">
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
              href="/logs"
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
              <button
                onClick={() => setActiveTab("residents")}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-blue-500 hover:shadow-xl transition-all text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">
                    {stats.totalResidents}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-1">
                  Total Residents
                </h3>
                <p className="text-sm text-navy-600">
                  Active residents in the system
                </p>
                <p className="text-xs text-blue-600 font-semibold mt-2">
                  View all residents →
                </p>
              </button>

              {/* V7.1: Current Occupancy - Goes to Occupancy tab */}
              <button
                onClick={() => setActiveTab("occupancy")}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-teal-500 hover:shadow-xl transition-all text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-teal-100 p-3 rounded-lg">
                    <Activity className="w-6 h-6 text-teal-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">
                    {stats.currentOccupancy}
                  </span>
                </div>
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
              </button>

              {/* V7.1: Active Rules - Clickable */}
              <button
                onClick={() => setActiveTab("rules")}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-purple-500 hover:shadow-xl transition-all text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">
                    {stats.activeRules}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-1">
                  Active Rules
                </h3>
                <p className="text-sm text-navy-600">
                  Access control rules in effect
                </p>
                <p className="text-xs text-purple-600 font-semibold mt-2">
                  Manage rules →
                </p>
              </button>

              {/* V7.2: Mini Revenue Widget - Fixed Loading Bug */}
              <button
                onClick={() => {
                  setActiveTab("revenue");
                }}
                className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-green-500 hover:shadow-xl transition-all text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
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
                <h3 className="text-lg font-semibold text-navy-900 mb-1">
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
                  href="/logs"
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
            {/* Add Resident Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Resident
              </h2>
              <form
                onSubmit={addResident}
                className="grid grid-cols-1 md:grid-cols-6 gap-4"
              >
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newResidentName}
                  onChange={(e) => setNewResidentName(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newResidentEmail}
                  onChange={(e) => setNewResidentEmail(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                <input
                  type="text"
                  placeholder="Unit #"
                  value={newResidentUnit}
                  onChange={(e) => setNewResidentUnit(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={newResidentPhone}
                  onChange={(e) => setNewResidentPhone(e.target.value)}
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
                {/* V8.5 Fix #4: Guest Limit with proper vertical alignment */}
                <div className="flex flex-col justify-end">
                  <input
                    type="number"
                    placeholder={
                      maxGuestsPerResident > 0
                        ? `Default: ${maxGuestsPerResident} guests`
                        : "Default: ... guests"
                    }
                    value={newResidentGuestLimit}
                    onChange={(e) => setNewResidentGuestLimit(e.target.value)}
                    min="0"
                    max="10"
                    className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                    title={`Leave blank to use facility default (${maxGuestsPerResident})`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingResident}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {isAddingResident ? "Adding..." : "Add Resident"}
                </button>
                <CsvUploader onUploadComplete={loadData} />
              </form>
            </div>

            {/* Residents Table - V7.5 Issue #4: Sticky first column + scrollable */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-navy-200">
              <div className="overflow-x-auto max-h-[600px] relative">
                <table className="w-full">
                  <thead className="bg-navy-800 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold sticky left-0 bg-navy-800 z-20">
                        Resident
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold">
                        Unit
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold">
                        Location
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-bold">
                        Access PIN
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-bold">
                        Guest Limit
                      </th>
                      {rules.map((rule) => (
                        <th
                          key={rule.id}
                          className="px-6 py-4 text-center text-sm font-bold"
                        >
                          {rule.rule_name}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-center text-sm font-bold">
                        QR Code
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-200">
                    {residents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={rules.length + 5}
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
                          <td
                            className={`px-6 py-4 sticky left-0 z-10 ${idx % 2 === 0 ? "bg-white" : "bg-navy-50"}`}
                          >
                            <div>
                              <div className="font-semibold text-navy-900">
                                {resident.name}
                              </div>
                              <div className="text-sm text-navy-600">
                                {resident.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-navy-700">
                              <Home className="w-4 h-4" />
                              <span className="font-medium">
                                {resident.unit}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
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
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono text-lg font-bold text-navy-900 bg-yellow-100 px-3 py-1 rounded">
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
                          <td className="px-6 py-4 text-center">
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
                              className="px-3 py-1 border-2 border-navy-300 rounded-lg text-sm font-semibold text-navy-900 bg-white focus:ring-2 focus:ring-teal-500"
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
                                className="px-6 py-4 text-center"
                              >
                                {/* V5: Wide Pill Toggle - YES/NO Design */}
                                <button
                                  onClick={() =>
                                    toggleRule(resident.id, rule.id, status)
                                  }
                                  className={`relative inline-flex h-10 w-20 items-center justify-between rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md ${
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
                                    className={`absolute left-2 text-xs font-bold text-white transition-opacity duration-200 ${
                                      status ? "opacity-100" : "opacity-0"
                                    }`}
                                  >
                                    YES
                                  </span>

                                  {/* RIGHT Text: NO (visible when FALSE) */}
                                  <span
                                    className={`absolute right-3 text-xs font-bold text-white transition-opacity duration-200 ${
                                      !status ? "opacity-100" : "opacity-0"
                                    }`}
                                  >
                                    NO
                                  </span>

                                  {/* Sliding Knob */}
                                  <span
                                    className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                      status
                                        ? "translate-x-1"
                                        : "translate-x-11"
                                    }`}
                                  />
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setSelectedResident(resident)}
                              className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all"
                            >
                              View QR
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

                  {/* 4. Active Passes */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200 hover:border-green-400 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-6 h-6 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">
                        {revenueData.summary.activePasses}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">
                      Active Passes
                    </h3>
                    <p className="text-xs text-navy-600">
                      Currently valid passes
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
                        onClick={exportRevenueCSV}
                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
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
                        {getFilteredRevenue().passes} passes sold • ${revenueData.summary.guestPassPrice.toFixed(2)} per pass
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
                        0 passes sold • $5.00 per pass
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
                    Export Multi-Day Data
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
    </div>
  );
}
