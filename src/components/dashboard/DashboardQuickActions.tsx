"use client";
import StartInspectionCard from "@/components/dashboard/StartInspectionCard";
import AddApartmentCard from "@/components/dashboard/AddApartmentCard";

export default function DashboardQuickActions() {
  return (
    <section>
      <h2 className="text-lg font-semibold text-nhome-foreground">Quick Actions</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <StartInspectionCard />
        </div>
        <div>
          <AddApartmentCard />
        </div>
      </div>
    </section>
  );
}
