"use client";
import StartInspectionCard from "@/components/dashboard/StartInspectionCard";
import AddApartmentCard from "@/components/dashboard/AddApartmentCard";
import AddProjectCard from "@/components/dashboard/AddProjectCard";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function DashboardQuickActions() {
  const { user, loading } = useAuthUser();

  if (loading) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-nhome-foreground">Quick Actions</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <StartInspectionCard />
        </div>
        <div>
          <AddApartmentCard />
        </div>
        {user?.role === "admin" && (
          <div>
            <AddProjectCard />
          </div>
        )}
      </div>
    </section>
  );
}
