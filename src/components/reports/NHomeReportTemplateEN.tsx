import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Roboto" },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: "#d29d54", paddingBottom: 10 },
  title: { fontSize: 20, color: "#8f8552", textAlign: "center" },
  sub: { fontSize: 12, color: "#475569", textAlign: "center", marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 16 },
  cell: { width: "48%", marginBottom: 8 },
  label: { fontSize: 10, color: "#a59a5e" },
  value: { fontSize: 11, color: "#0f172a" },
  h2: { fontSize: 14, color: "#8f8552", marginTop: 18, marginBottom: 8 },
  text: { fontSize: 11, color: "#0f172a", lineHeight: 1.5 },
  item: { marginTop: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: "#e5e7eb", backgroundColor: "#f8fafc" },
  photo: { width: "48%", height: 110, marginTop: 6, borderWidth: 1, borderColor: "#e5e7eb" },
});

export const NHomeReportTemplateEN = ({ data }: { data: any }) => {
  const L = {
    title: "SNAG LIST INSPECTION",
    company_title: "NHome Property Setup & Management",
    client: "Client",
    property: "Property",
    apartment: "Unit",
    date: "Date",
    inspector: "Inspector",
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.title}>{L.title}</Text>
            <Text style={styles.sub}>{L.company_title}</Text>
          </View>
          <View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 100,
              height: 80,
              justifyContent: "center",
              alignItems: "flex-end",
            }}
          >
            <Image
              src="https://www.nhomesetup.com/branding/logos/nhome-logo-primary.png"
              style={{ width: 80, height: 80, objectFit: "contain" }}
            />
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.client}:</Text>
            <Text style={styles.value}>{data.project.developer_name}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.property}:</Text>
            <Text style={styles.value}>{data.project.name}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.apartment}:</Text>
            <Text style={styles.value}>{data.apartment.unit_number}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.date}:</Text>
            <Text style={styles.value}>
              {format(new Date(data.session.started_at), "PPP", { locale: enGB })}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.inspector}:</Text>
            <Text style={styles.value}>NHome Professional Team</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 }} />

        {(Object.entries(
          data.results.reduce((acc: Record<string, any[]>, it: any) => {
            const room = it.checklist_templates?.room_type || "Uncategorized";
            if (!acc[room]) acc[room] = [];
            acc[room].push(it);
            return acc;
          }, {})
        ) as [string, any[]][]).map(([room, items], ri) => (
          <View key={`room-${ri}`} style={{ marginBottom: 16 }}>
            <Text style={[styles.h2, { marginTop: 12 }]}>{room}</Text>
            {items.map((it: any, i: number) => (
              <View key={`item-${ri}-${i}`} style={styles.item}>
                <Text style={styles.text}>
                  {`${it.checklist_templates?.item_description || `Item ${it.item_id}`} (${it.status}) — Checked`}
                </Text>
                {it.notes && <Text style={styles.text}>{`Notes: ${it.notes}`}</Text>}
                {/* ✅ Use photo_urls from inspection_results if available */}
                {it.photo_urls?.length
                  ? it.photo_urls.slice(0, 2).map((url: string, j: number) => (
                      <Image key={j} style={styles.photo} src={url} />
                    ))
                  : it.preview_photos?.slice(0, 2).map((p: any, j: number) => (
                      <Image key={j} style={styles.photo} src={p.url} />
                    ))}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
};
