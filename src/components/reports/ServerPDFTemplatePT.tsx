import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

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
});

interface ServerPDFData {
  session: any;
  apartment: any;
  project: any;
  results: any[];
}

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

export const ServerPDFTemplatePT = ({ data }: { data: ServerPDFData }) => {
  // Group results by room (use Portuguese room type if available)
  const resultsByRoom = data.results.reduce((acc: Record<string, any[]>, it: any) => {
    const room = it.checklist_templates?.room_type_pt || it.checklist_templates?.room_type || "Sem categoria";
    if (!acc[room]) acc[room] = [];
    acc[room].push(it);
    return acc;
  }, {});

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>INSPEÇÃO DE LISTA DE PENDÊNCIAS</Text>
          <Text style={styles.sub}>NHome Property Setup & Management</Text>
        </View>

        {/* Info Grid */}
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.label}>Imóvel:</Text>
            <Text style={styles.value}>{data.project?.name || 'N/A'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>
              {data.apartment?.client_name && data.apartment?.client_surname
                ? `${data.apartment.client_name} ${data.apartment.client_surname}`
                : data.apartment?.client_name || 'Sem Cliente Atribuído'}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Fração:</Text>
            <Text style={styles.value}>{data.apartment?.unit_number || 'N/A'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Data:</Text>
            <Text style={styles.value}>
              {data.session?.started_at
                ? format(new Date(data.session.started_at), "PPP", { locale: pt })
                : 'N/A'}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Inspetor:</Text>
            <Text style={styles.value}>Equipa Profissional NHome</Text>
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
                    {`${translateItem(it.checklist_templates?.item_description_pt || it.checklist_templates?.item_description) || `Item ${it.item_id}`} - Bom`}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.text}>
                      {`${translateItem(it.checklist_templates?.item_description_pt || it.checklist_templates?.item_description) || `Item ${it.item_id}`} - ${it.status === 'critical' ? 'Crítico' : 'Problema'}`}
                    </Text>
                    {(it.pt_notes || it.notes) && (
                      <Text style={styles.text}>{`Observação: ${it.pt_notes || it.notes}`}</Text>
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
