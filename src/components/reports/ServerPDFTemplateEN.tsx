import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: "#d29d54", paddingBottom: 10 },
  title: { fontSize: 20, color: "#8f8552" },
  sub: { fontSize: 12, color: "#475569", marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 16 },
  cell: { width: "48%", marginBottom: 8 },
  label: { fontSize: 10, color: "#a59a5e" },
  value: { fontSize: 11, color: "#0f172a" },
  h2: { fontSize: 14, color: "#8f8552", marginTop: 18, marginBottom: 8 },
  text: { fontSize: 11, color: "#0f172a", lineHeight: 1.5 },
  item: { marginTop: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: "#e5e7eb", backgroundColor: "#f8fafc" },
  photo: { width: 200, height: 150, marginTop: 6 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
});

interface ServerPDFData {
  session: any;
  apartment: any;
  project: any;
  results: any[];
}

export const ServerPDFTemplateEN = ({ data }: { data: ServerPDFData }) => {
  // Group results by room
  const resultsByRoom = data.results.reduce((acc: Record<string, any[]>, it: any) => {
    const room = it.checklist_templates?.room_type || "Uncategorized";
    if (!acc[room]) acc[room] = [];
    acc[room].push(it);
    return acc;
  }, {});

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>SNAG LIST & INSPECTION</Text>
          <Text style={styles.sub}>NHome Property Setup & Management</Text>
        </View>

        {/* Info Grid */}
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.label}>Property:</Text>
            <Text style={styles.value}>{data.project?.name || 'N/A'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Client:</Text>
            <Text style={styles.value}>
              {data.apartment?.client_name && data.apartment?.client_surname
                ? `${data.apartment.client_name} ${data.apartment.client_surname}`
                : data.apartment?.client_name || 'No Client Assigned'}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Unit:</Text>
            <Text style={styles.value}>{data.apartment?.unit_number || 'N/A'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>
              {data.session?.started_at
                ? format(new Date(data.session.started_at), "PPP", { locale: enGB })
                : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 }} />

        {/* Results by Room */}
        {Object.entries(resultsByRoom).map(([room, items], ri) => (
          <View key={`room-${ri}`} style={{ marginBottom: 16 }}>
            <Text style={[styles.h2, { marginTop: 12 }]}>{room}</Text>
            {(items as any[]).map((it: any, i: number) => (
              <View key={`item-${ri}-${i}`} style={styles.item}>
                {it.status === 'good' ? (
                  <Text style={styles.text}>
                    {`${it.checklist_templates?.item_description || `Item ${it.item_id}`} - Good`}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.text}>
                      {`${it.checklist_templates?.item_description || `Item ${it.item_id}`} - ${it.status === 'critical' ? 'Critical' : 'Issue'}`}
                    </Text>
                    {it.notes && (
                      <Text style={styles.text}>{`Notes: ${it.notes}`}</Text>
                    )}
                    {it.photo_base64_urls?.slice(0, 2).map((base64Url: string, j: number) => (
                      <Image key={j} style={styles.photo} src={base64Url} />
                    ))}
                  </>
                )}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
};
