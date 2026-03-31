import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0a0a 0%, #0f1419 40%, #0a0a0a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow behind logo */}
        <div
          style={{
            position: "absolute",
            width: "600",
            height: "600",
            borderRadius: "300",
            background:
              "radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 40%, transparent 70%)",
            top: "-60",
            display: "flex",
          }}
        />

        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: "0",
            display: "flex",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="data:image/svg+xml,%3Csvg width='486' height='486' viewBox='0 0 486 486' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23c)'%3E%3Cpath d='M253 347.8v41.3c0 15.1-12.4 27.5-27.6 27.5v-69.7c5.8 1 11.6 1.5 17.6 1.5 3.4 0 6.7-.2 10-.4v-.1Z' fill='%23E8EEF1'/%3E%3Cpath d='M225.3 416.5v69.6a243 243 0 0 1-27.5-3.5V444c0-15.2 12.4-27.5 27.5-27.5Z' fill='%23E8EEF1'/%3E%3Cpath d='m212.1 343.7-15.8 38a131 131 0 0 1-36-51.5l26.7-64.3a131 131 0 0 0 25.1 77.8Z' fill='%23E8EEF1'/%3E%3Cpath d='m160.4 396.5-26.8 64.3a243 243 0 0 1-24.1-17.9l14.9-35.5c5.8-14 21.9-20.7 35.9-14.9Z' fill='%23E8EEF1'/%3E%3Cpath d='m176 324.1-29.2 29.1c-10.7 10.7-28.2 10.7-38.9 0l49.4-49.3a131 131 0 0 0 18.7 20.2Z' fill='%23E8EEF1'/%3E%3Cpath d='M107.9 353.2 58.6 402.4a243 243 0 0 1-16.9-22l27.3-27.3c10.7-10.7 28.2-10.7 38.9 0Z' fill='%23E8EEF1'/%3E%3Cpath d='m150 292.4-38 15.7c-14 5.8-30.1-.9-35.9-15l64.4-26.6a131 131 0 0 0 9.5 25.9Z' fill='%23E8EEF1'/%3E%3Cpath d='m76.1 293.1-64.4 26.6a243 243 0 0 1-7.3-26.9l35.7-14.7c14-5.8 30.1.9 35.9 15Z' fill='%23E8EEF1'/%3E%3Cpath d='M137.8 243c0 3.4.2 6.7.5 10h-41.2c-15.2-.1-27.5-12.4-27.5-27.7h69.7c-1 5.8-1.5 11.6-1.5 17.6Z' fill='%23E8EEF1'/%3E%3Cpath d='M69.6 225.4H0c.6-9.5 1.7-18.7 3.6-27.6h38.5c15.1 0 27.5 12.3 27.5 27.6Z' fill='%23E8EEF1'/%3E%3Cpath d='M153.9 187.1a131 131 0 0 0-11.5 25.1l-38-15.8c-14-5.9-20.7-22-14.9-36.1l64.4 26.8Z' fill='%23E8EEF1'/%3E%3Cpath d='m89.6 160.3-64.3-26.7a243 243 0 0 1 13.8-24l35.6 14.8c14 5.9 20.7 22 14.9 36Z' fill='%23E8EEF1'/%3E%3Cpath d='M182 157.2a131 131 0 0 0-20.2 18.8l-29.1-29.2c-10.7-10.7-10.7-28.2 0-38.9l49.3 49.3Z' fill='%23E8EEF1'/%3E%3Cpath d='M132.8 107.9 83.7 58.5a243 243 0 0 1 22-16.9l27.3 27.3c10.7 10.7 10.7 28.1 0 38.9Z' fill='%23E8EEF1'/%3E%3Cpath d='M219.5 140.4a131 131 0 0 0-25.8 9.5L177.9 112c-5.8-14 .9-30.1 15-36l26.6 64.4Z' fill='%23E8EEF1'/%3E%3Cpath d='m192.8 76-26.5-64.4a243 243 0 0 1 26.8-7.2l14.7 35.7c5.8 14-.9 30.1-15 35.9Z' fill='%23E8EEF1'/%3E%3Cpath d='M260.7 69.5v69.7c-5.8-1-11.7-1.5-17.7-1.5-3.4 0-6.7.2-9.9.5V97c0-15.1 12.4-27.5 27.6-27.5Z' fill='%23E8EEF1'/%3E%3Cpath d='M288.2 3.6V42c0 15.2-12.4 27.5-27.5 27.5V0c9.4.5 18.5 1.7 27.5 3.6Z' fill='%23E8EEF1'/%3E%3Cpath d='m325.6 89.5-26.7 64.3a131 131 0 0 0-25.1-11.4l15.8-38c5.8-14 22-20.7 36-14.9Z' fill='%23E8EEF1'/%3E%3Cpath d='m376.4 39.1-14.8 35.5c-5.8 14-22 20.7-36 14.9l26.8-64.3a243 243 0 0 1 24 13.9Z' fill='%23E8EEF1'/%3E%3Cpath d='m378.1 132.8-49.4 49.3a131 131 0 0 0-18.7-20.2l29.2-29.1c10.7-10.7 28.1-10.7 38.9 0Z' fill='%23E8EEF1'/%3E%3Cpath d='m444.3 105.6-27.3 27.3c-10.7 10.7-28.2 10.6-38.9 0l49.2-49.1a243 243 0 0 1 17 21.8Z' fill='%23E8EEF1'/%3E%3Cpath d='m409.9 192.9-64.4-26.6a131 131 0 0 0-9.5-26l38-15.6c14-5.8 30.1.9 35.9 15l.1.1Z' fill='%23E8EEF1'/%3E%3Cpath d='m481.6 193.2-35.7 14.6c-14 5.8-30.1-.9-35.9-14.9l64.4-26.7a243 243 0 0 1 7.2 27Z' fill='%23E8EEF1'/%3E%3Cpath d='M346.7 260.6c1-5.7 1.5-11.6 1.5-17.5 0-3.4-.2-6.7-.5-10H389c15.2.1 27.5 12.4 27.5 27.6h-69.7Z' fill='%23E8EEF1'/%3E%3Cpath d='M486 260.8a243 243 0 0 1-3.6 27.5h-38.5c-15.1-.1-27.5-12.4-27.5-27.6h69.5Z' fill='%23E8EEF1'/%3E%3Cpath d='M396.4 325.7 332 299a131 131 0 0 0 11.6-25.1l38 15.9c14 5.8 20.7 21.9 14.9 35.9Z' fill='%23E8EEF1'/%3E%3Cpath d='m460.7 352.4a243 243 0 0 1-13.8 24l-35.6-14.8c-14-5.8-20.7-21.9-14.9-36l64.3 26.8Z' fill='%23E8EEF1'/%3E%3Cpath d='m353.2 378.1-49.2-49.3a131 131 0 0 0 20.1-18.8l29.1 29.2c10.7 11 10.7 28.2 0 38.9Z' fill='%23E8EEF1'/%3E%3Cpath d='m402.3 427.5a243 243 0 0 1-22 16.9l-27.1-27.3c-10.7-10.8-10.7-28.2 0-38.9l49.2 49.3Z' fill='%23E8EEF1'/%3E%3Cpath d='m293 410-26.5-64.4a131 131 0 0 0 25.8-9.5l15.7 38c5.8 14-.9 30.2-15 36Z' fill='%23E8EEF1'/%3E%3Cpath d='m319.6 474.4a243 243 0 0 1-26.8 7.2l-14.6-35.6c-5.8-14 .9-30.1 15-36l26.5 64.3Z' fill='%23E8EEF1'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='c'%3E%3Crect width='486' height='486' fill='%23fff'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E"
            width="120"
            height="120"
            alt=""
          />
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12",
          }}
        >
          <div
            style={{
              fontSize: "64",
              fontWeight: "700",
              color: "#ffffff",
              letterSpacing: "-2",
              lineHeight: "1",
              display: "flex",
            }}
          >
            SciWeave
          </div>

          {/* MCP badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10",
              marginTop: "8",
            }}
          >
            <div
              style={{
                fontSize: "22",
                fontWeight: "600",
                color: "#3b82f6",
                letterSpacing: "4",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              MCP Server
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: "80",
              height: "2",
              background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
              marginTop: "16",
              marginBottom: "8",
              display: "flex",
            }}
          />

          {/* Description */}
          <div
            style={{
              fontSize: "24",
              color: "#a3a3a3",
              textAlign: "center",
              maxWidth: "700",
              lineHeight: "1.5",
              display: "flex",
            }}
          >
            Search research papers and get AI-powered
          </div>
          <div
            style={{
              fontSize: "24",
              color: "#a3a3a3",
              textAlign: "center",
              maxWidth: "700",
              lineHeight: "1.5",
              display: "flex",
            }}
          >
            answers with citations — right inside Claude
          </div>
        </div>

        {/* Tool pills at the bottom */}
        <div
          style={{
            display: "flex",
            gap: "12",
            marginTop: "40",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {["ask_research_question", "list_collections", "get_collection_papers", "get_research_thread"].map(
            (tool) => (
              <div
                key={tool}
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: "8",
                  fontSize: "14",
                  fontFamily: "monospace",
                  color: "#60a5fa",
                }}
              >
                {tool}
              </div>
            )
          )}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: "24",
            display: "flex",
            alignItems: "center",
            gap: "6",
            fontSize: "14",
            color: "#525252",
          }}
        >
          sciweave.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
