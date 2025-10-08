import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"

interface NHomeReportDocumentProps {
  data: any
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 20,
    color: "#1E3A8A",
  },
  section: {
    marginBottom: 15,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  text: {
    marginBottom: 3,
  },
  image: {
    width: 150,
    height: 100,
    marginRight: 10,
    marginBottom: 10,
  },
  imageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
})

export const NHomeReportDocument: React.FC<NHomeReportDocumentProps> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>NHome Professional Inspection Report</Text>

      <View style={styles.section}>
        <Text style={styles.title}>Project Information</Text>
        <Text style={styles.text}>Project: {data.project?.name}</Text>
        <Text style={styles.text}>Developer: {data.developer?.name}</Text>
        <Text style={styles.text}>
          Unit: {data.apartment?.unit_number} - Type: {data.apartment?.apartment_type}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Inspection Summary</Text>
        <Text style={styles.text}>
          Date:{" "}
          {data.session?.created_at
            ? new Date(data.session.created_at).toLocaleDateString()
            : data.session?.inspection_date || "N/A"}
        </Text>
        <Text style={styles.text}>Inspector: {data.inspector?.name || "NHome Professional Team"}</Text>
        <Text style={styles.text}>Total Items: {data.results?.length || 0}</Text>

        {data.results && data.results.length > 0 && (
          <Text style={styles.text}>
            {(() => {
              const total = data.results.length
              const good = data.results.filter((r: any) => r.status === "good").length
              const issues = data.results.filter((r: any) => r.status !== "good").length
              const score = Math.max(1, (good / total) * 10 - (issues / total) * 2).toFixed(1)
              return `${score}/10 | ${good} good | ${issues} issues`
            })()}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>All Areas</Text>
        {data.results?.map((item: any, i: number) => (
          <View key={i} style={styles.section}>
            <Text style={styles.title}>
              {i + 1}. {item.checklist_templates?.item_name || item.checklist_templates?.title || "Unnamed Item"} ({item.priority_level || "N/A"})
            </Text>
            <Text style={styles.text}>Room: {item.checklist_templates?.room || item.room || "N/A"}</Text>
            <Text style={styles.text}>Category: {item.checklist_templates?.category || item.category || "N/A"}</Text>
            <Text style={styles.text}>Status: {item.status}</Text>
            <Text style={styles.text}>Notes: {item.comment || item.notes || "No notes"}</Text>

            {item.preview_photos?.length > 0 ? (
              <View style={styles.imageRow}>
                {item.preview_photos.map((p: any, j: number) => {
                  const src = p.base64 || p.url
                  return src ? <Image key={j} src={src} style={styles.image} /> : null
                })}
              </View>
            ) : (
              <Text style={styles.text}>No photos available</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Company Information</Text>
        <Text style={styles.text}>{data.company_info?.name}</Text>
        <Text style={styles.text}>{data.company_info?.location}</Text>
        <Text style={styles.text}>{data.company_info?.website}</Text>
        <Text style={styles.text}>Email: {data.company_info?.email}</Text>
        <Text style={styles.text}>Established: {data.company_info?.established}</Text>
      </View>
    </Page>
  </Document>
)
