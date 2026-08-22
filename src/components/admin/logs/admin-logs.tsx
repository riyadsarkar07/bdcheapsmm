"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/utils";
import type { LogAction } from "@/lib/types/database";

type LogRow = {
  id: string;
  action: LogAction;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  ip: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export function AdminLogs({ logs }: { logs: LogRow[] }) {
  const [search, setSearch] = React.useState("");

  const filtered = logs.filter((log) => {
    const haystack = [
      log.action,
      log.entity_type ?? "",
      log.description ?? "",
      log.ip ?? "",
      log.profiles?.email ?? "",
      log.profiles?.full_name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No logs found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{log.action.replace("_", " ")}</Badge>
                      </td>
                      <td className="max-w-[160px] px-4 py-3">
                        <p className="line-clamp-1 font-medium">{log.profiles?.full_name ?? "System"}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{log.profiles?.email}</p>
                      </td>
                      <td className="max-w-[300px] px-4 py-3">
                        <p className="line-clamp-1 text-muted-foreground">{log.description ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {log.entity_type ? `${log.entity_type}${log.entity_id ? `:${log.entity_id}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{log.ip ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(log.created_at, "MMM d, h:mm a")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
