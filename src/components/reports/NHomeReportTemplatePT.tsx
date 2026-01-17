import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// Use absolute URL for logo - relative paths don't work in @react-pdf/renderer
const LOGO_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/branding/logos/NHome_V4__Logo.png`
  : '/branding/logos/NHome_V4__Logo.png';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
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

export const NHomeReportTemplatePT = ({ data }: { data: any }) => {
  const L = {
    title: "INSPEÇÃO DE LISTA DE PENDÊNCIAS",
    company_title: "NHome Property Setup & Management",
    client: "Cliente",
    property: "Imóvel",
    apartment: "Fração",
    date: "Data",
    inspector: "Inspetor",
  };

  const translateItem = (desc?: string) => {
    if (!desc) return "";
    const dict: Record<string, string> = {
      Lights: "Luzes",
      Ceiling: "Teto",
      "Walls / wood panels": "Paredes / painéis de madeira",
      Door: "Porta",
      "Floor & skirting": "Pavimento e rodapés",
      Window: "Janela",
      Kitchen: "Cozinha",
      Bathroom: "Casa de banho",
      Hall: "Corredor",
    };
    return dict[desc] || desc;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
<View
  style={[
    styles.header,
    {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
  ]}
>
  <View style={{ flex: 1 }}>
    <Text style={[styles.title, { textAlign: "left" }]}>{L.title}</Text>
    <Text style={[styles.sub, { textAlign: "left" }]}>{L.company_title}</Text>
  </View>
  <Image
    src={LOGO_URL}
    style={{ width: 80, height: 80, objectFit: "contain" }}
  />
</View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.property}:</Text>
            <Text style={styles.value}>{data.project.name}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.client}:</Text>
            <Text style={styles.value}>
              {data.apartment?.client_name && data.apartment?.client_surname
                ? `${data.apartment.client_name} ${data.apartment.client_surname}`
                : data.apartment?.client_name || data.apartment?.client_surname || 'Sem Cliente Atribuído'}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.apartment}:</Text>
            <Text style={styles.value}>{data.apartment.unit_number}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.date}:</Text>
            <Text style={styles.value}>
              {format(new Date(data.session.started_at), "PPP", { locale: pt })}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>{L.inspector}:</Text>
            <Text style={styles.value}>Equipa Profissional NHome</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 }} />

        {(Object.entries(
          data.results.reduce((acc: Record<string, any[]>, it: any) => {
            const room = it.checklist_templates?.room_type || "Sem categoria";
            if (!acc[room]) acc[room] = [];
            acc[room].push(it);
            return acc;
          }, {})
        ) as [string, any[]][]).map(([room, items], ri) => (
          <View key={`room-${ri}`} style={{ marginBottom: 16 }}>
            <Text style={[styles.h2, { marginTop: 12 }]}>{room}</Text>
            {items.map((it: any, i: number) => (
              <View key={`item-${ri}-${i}`} style={styles.item}>
                {it.status === 'good' ? (
                  // For good items: just "Item name - Bom"
                  <Text style={styles.text}>
                    {`${translateItem(it.checklist_templates?.item_description || `Item ${it.item_id}`)} - Bom`}
                  </Text>
                ) : (
                  // For issue/critical items: show status and notes
                  <>
                    <Text style={styles.text}>
                      {`${translateItem(it.checklist_templates?.item_description || `Item ${it.item_id}`)} - ${it.status === 'critical' ? 'Crítico' : 'Problema'}`}
                    </Text>
                    {(it.pt_notes || it.notes) && (
                      <Text style={styles.text}>
                        {`Observação: ${it.pt_notes || it.translated_note || it.notes}`}
                      </Text>
                    )}
                    {/* Photos - pre-fetched as base64 for client-side rendering */}
                    {it.photo_base64_urls?.length > 0 && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
                        {it.photo_base64_urls.slice(0, 2).map((base64Url: string, j: number) => (
                          <Image key={`photo-${j}`} src={base64Url} style={{ ...styles.photo, marginRight: 4 }} />
                        ))}
                      </View>
                    )}
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
