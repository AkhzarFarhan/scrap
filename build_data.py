import json
import os
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')

UBIVERSE_ASSETS = r"C:\GitHub\Ubiverse\feature\productivity\src\main\assets"
SCRAP_DIR = r"C:\GitHub\scrap"
DATA_DIR = os.path.join(SCRAP_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)


def format_cpp_code(raw: str) -> str:
    """Port of formatCppCode from Ubiverse ProductivityComponents.kt."""
    raw_lines = raw.split("\n")
    lines = []

    for line in raw_lines:
        trimmed = line.strip()
        if not trimmed:
            lines.append("")
            continue

        if trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("#") or trimmed.startswith("*"):
            lines.append(trimmed)
            continue

        comment = ""
        code_part = line
        comment_idx = -1
        in_str = False
        for idx, ch in enumerate(line):
            if ch == '"' and (idx == 0 or line[idx - 1] != '\\'):
                in_str = not in_str
            elif not in_str and ch == '/' and idx + 1 < len(line) and line[idx + 1] == '/':
                comment_idx = idx
                break

        if comment_idx != -1:
            code_part = line[:comment_idx]
            comment = line[comment_idx:].strip()

        sub_lines = []
        cur = []
        p_depth = 0
        in_s = False
        i = 0
        chars = code_part
        n = len(chars)

        while i < n:
            c = chars[i]
            if c == '"' and (i == 0 or chars[i - 1] != '\\'):
                in_s = not in_s
                cur.append(c)
                i += 1
                continue
            if in_s:
                cur.append(c)
                i += 1
                continue

            if c == '(':
                p_depth += 1
                cur.append(c)
                i += 1
                continue
            elif c == ')':
                p_depth = max(0, p_depth - 1)
                cur.append(c)
                i += 1
                continue

            if c == '{':
                prefix = "".join(cur).strip()
                if prefix:
                    sub_lines.append(prefix)
                sub_lines.append("{")
                cur.clear()
                i += 1
                continue

            if c == '}':
                prefix = "".join(cur).strip()
                if prefix:
                    sub_lines.append(prefix)
                j = i + 1
                while j < n and chars[j].isspace():
                    j += 1
                if j < n and chars[j] == ';':
                    sub_lines.append("};")
                    i = j + 1
                else:
                    sub_lines.append("}")
                    i += 1
                cur.clear()
                continue

            if c == ';' and p_depth == 0:
                cur.append(';')
                stmt = "".join(cur).strip()
                if stmt:
                    sub_lines.append(stmt)
                cur.clear()
                i += 1
                continue

            cur.append(c)
            i += 1

        remaining = "".join(cur).strip()
        if remaining:
            sub_lines.append(remaining)

        if comment:
            if sub_lines:
                sub_lines[-1] = sub_lines[-1] + "  " + comment
            else:
                sub_lines.append(comment)

        lines.extend(sub_lines)

    indent_level = 0
    result = []
    for l in lines:
        s = l.strip()
        if not s:
            result.append("")
            continue
        if s.startswith("#"):
            result.append(s)
            continue
        if s.startswith("}"):
            indent_level = max(0, indent_level - 1)
            result.append(("    " * indent_level) + s)
            continue
        if s in ("public:", "private:", "protected:", "default:") or (s.startswith("case ") and s.endswith(":")):
            res_indent = max(0, indent_level - 1)
            result.append(("    " * res_indent) + s)
            continue
        result.append(("    " * indent_level) + s)
        if s == "{" or s.endswith("{"):
            indent_level += 1

    # Collapse multiple consecutive blank lines to max 1 blank line
    cleaned = []
    prev_blank = False
    for r in result:
        if r == "":
            if not prev_blank:
                cleaned.append(r)
            prev_blank = True
        else:
            cleaned.append(r)
            prev_blank = False

    return "\n".join(cleaned).strip()


# 1. Copy raw JSON files
for fn in ["cpp_knowledgebase.json", "nr_knowledgebase.json", "nr_question_bank.json"]:
    src = os.path.join(UBIVERSE_ASSETS, fn)
    dst = os.path.join(DATA_DIR, fn)
    shutil.copy2(src, dst)
    print(f"Copied {fn} to {dst}")

# 2. Load and enrich C++ Knowledgebase
with open(os.path.join(UBIVERSE_ASSETS, "cpp_knowledgebase.json"), encoding="utf-8") as f:
    cpp_data = json.load(f)

for day_obj in cpp_data["days"]:
    day_num = day_obj["day"]
    if "subtopics" in day_obj and day_obj["subtopics"]:
        for idx, sub in enumerate(day_obj["subtopics"]):
            sub["id"] = f"day_{day_num}_sub_{idx}"
            sub["day"] = day_num
            sub["index"] = idx
            for ex in sub.get("examples", []):
                ex["formatted_code"] = format_cpp_code(ex["code"])
            for m_idx, mcq in enumerate(sub.get("mcqs", [])):
                mcq["id"] = f"day_{day_num}_sub_{idx}_mcq_{m_idx}"
    else:
        # Day 17 (Summary Revision) synthesis matching KnowledgebaseLoader.kt
        synthesized = []
        mcqs_all = day_obj.get("mcqs", [])

        # Subtopic 0: 16-Day Quick Reference Guide
        qr_list = day_obj.get("quick_reference", [])
        if qr_list:
            qr_lines = [
                "### C++ 16-Day Quick Reference Guide",
                "A condensed day-by-day summary of the foundational concepts, modern techniques, and architectural paradigms covered throughout the 16-day core C++ curriculum.",
                ""
            ]
            for qr in qr_list:
                qr_lines.append(f"#### Day {qr['day']}: {qr['topic']}")
                for kp in qr.get("key_points", []):
                    qr_lines.append(f"- {kp}")
                qr_lines.append("")
            synthesized.append({
                "id": f"day_{day_num}_sub_0",
                "day": day_num,
                "index": 0,
                "title": "C++ 16-Day Quick Reference Guide",
                "explanation": "\n".join(qr_lines).strip(),
                "examples": [],
                "pitfalls": [],
                "tips_to_remember": [kp for qr in qr_list for kp in qr.get("key_points", [])][:12],
                "questions": [],
                "mcqs": [
                    dict(m, id=f"day_{day_num}_sub_0_mcq_{i}")
                    for i, m in enumerate(mcqs_all[:20])
                ]
            })

        # Subtopic 1: C++ Core Cheat Sheet & Golden Rules
        cs_list = day_obj.get("cheat_sheet", [])
        if cs_list:
            cs_lines = [
                "### C++ Core Cheat Sheet & Golden Rules",
                "The ultimate set of golden rules, best practices, and essential idioms every senior C++ engineer must commit to memory.",
                ""
            ]
            for rule in cs_list:
                cs_lines.append(f"- {rule}")
            synthesized.append({
                "id": f"day_{day_num}_sub_1",
                "day": day_num,
                "index": 1,
                "title": "C++ Core Cheat Sheet & Golden Rules",
                "explanation": "\n".join(cs_lines).strip(),
                "examples": [],
                "pitfalls": [
                    "Returning std::move(x) on local variables defeats NRVO copy elision",
                    "Using volatile for multi-threading instead of std::atomic",
                    "Violating strict aliasing through raw reinterpret_cast"
                ],
                "tips_to_remember": cs_list,
                "questions": [],
                "mcqs": [
                    dict(m, id=f"day_{day_num}_sub_1_mcq_{i}")
                    for i, m in enumerate(mcqs_all[20:40])
                ]
            })

        # Subtopic 2: Cross-Topic Architectural Deep Dives
        ct_list = day_obj.get("cross_topic_questions", [])
        if ct_list:
            ct_lines = [
                "### Cross-Topic Architectural & Interview Questions",
                "High-level interview questions that bridge multiple C++ subsystems — connecting RAII with exception safety, move semantics with vector reallocation, cache lines with atomics, and vtables with multiple inheritance.",
                ""
            ]
            for ct in ct_list:
                ct_lines.append(f"#### Q: {ct['question']}")
                ct_lines.append(ct["answer"])
                if ct.get("topics_covered"):
                    ct_lines.append(f"*Topics Covered: {', '.join(ct['topics_covered'])}*")
                ct_lines.append("")
            synthesized.append({
                "id": f"day_{day_num}_sub_2",
                "day": day_num,
                "index": 2,
                "title": "Cross-Topic Architectural Deep Dives (20 Synthesis Q&As)",
                "explanation": "\n".join(ct_lines).strip(),
                "examples": [],
                "pitfalls": [],
                "tips_to_remember": [
                    "Always consider how language features interact (e.g., move semantics with NRVO and noexcept exception safety)",
                    "Hardware realities (64-byte cache lines, false sharing, branch prediction) directly impact software architecture"
                ],
                "questions": [
                    {"question": ct["question"], "answer": ct["answer"], "topics_covered": ct.get("topics_covered", [])}
                    for ct in ct_list
                ],
                "mcqs": [
                    dict(m, id=f"day_{day_num}_sub_2_mcq_{i}")
                    for i, m in enumerate(mcqs_all[40:60])
                ]
            })

        # Subtopic 3: Common C++ Interview Mistakes
        cim_list = day_obj.get("common_interview_mistakes", [])
        if cim_list:
            m_lines = [
                "### Common C++ Interview Mistakes by Topic",
                "Senior interviewers frequently test candidates on subtle misconceptions and common blunders across core language, memory management, smart pointers, and concurrency.",
                ""
            ]
            for cim in cim_list:
                m_lines.append(f"#### {cim['topic']}")
                for m in cim.get("mistakes", []):
                    m_lines.append(f"- {m}")
                m_lines.append("")
            synthesized.append({
                "id": f"day_{day_num}_sub_3",
                "day": day_num,
                "index": 3,
                "title": "Common Interview Pitfalls & Mistakes by Subsystem",
                "explanation": "\n".join(m_lines).strip(),
                "examples": [],
                "pitfalls": [m for cim in cim_list for m in cim.get("mistakes", [])],
                "tips_to_remember": [
                    "Be precise with C++ terminology: undefined behavior vs unspecified vs implementation-defined",
                    "Know the Rule of Zero/Five and never forget virtual destructors in polymorphic base classes"
                ],
                "questions": [],
                "mcqs": [
                    dict(m, id=f"day_{day_num}_sub_3_mcq_{i}")
                    for i, m in enumerate(mcqs_all[60:80])
                ]
            })

        # Subtopic 4: Mastery Revision Strategy & Final Exam
        strat_list = day_obj.get("revision_strategy_tips", [])
        strat_lines = [
            "### Mastery Revision Strategy & Comprehensive Review",
            "Proven preparation strategies and techniques to maximize retention, ace senior technical interviews, and apply modern C++ principles with confidence.",
            ""
        ]
        for tip in strat_list:
            strat_lines.append(f"- {tip}")
        synthesized.append({
            "id": f"day_{day_num}_sub_4",
            "day": day_num,
            "index": 4,
            "title": "Mastery Revision Strategy & Final Exam",
            "explanation": "\n".join(strat_lines).strip(),
            "examples": [],
            "pitfalls": [],
            "tips_to_remember": strat_list,
            "questions": [],
            "mcqs": [
                dict(m, id=f"day_{day_num}_sub_4_mcq_{i}")
                for i, m in enumerate(mcqs_all[80:])
            ]
        })

        day_obj["subtopics"] = synthesized

# 3. Load 5G NR Knowledgebase & Question Bank
with open(os.path.join(UBIVERSE_ASSETS, "nr_knowledgebase.json"), encoding="utf-8") as f:
    nr_data = json.load(f)

with open(os.path.join(UBIVERSE_ASSETS, "nr_question_bank.json"), encoding="utf-8") as f:
    nr_qbank = json.load(f)

# Add extra structured modules from NrTab.kt & Germany/India Career Playbook
nr_extras = {
    "formulasCheatSheet": [
        {
            "name": "Scalable Subcarrier Spacing (SCS)",
            "spec": "3GPP TS 38.211 §4.2",
            "formula": "Δf = 15 × 2^μ kHz   (μ ∈ {0, 1, 2, 3, 4} → 15, 30, 60, 120, 240 kHz)"
        },
        {
            "name": "Slot Duration & Subframe Scaling",
            "spec": "3GPP TS 38.211 §4.3.2",
            "formula": "T_slot = 1 / 2^μ ms   (μ=0: 1.0 ms | μ=1: 0.5 ms | μ=2: 0.25 ms | μ=3: 0.125 ms);  N_slot^subframe,μ = 2^μ"
        },
        {
            "name": "PDSCH Start & Length Indicator Value (SLIV)",
            "spec": "3GPP TS 38.214 §5.1.2.1",
            "formula": "If (L - 1) ≤ 7:  SLIV = 14 × (L - 1) + S\nElse:            SLIV = 14 × (14 - L + 1) + (14 - 1 - S)   [0 < L ≤ 14 - S]"
        },
        {
            "name": "Outer Loop Link Adaptation (OLLA) Steady-State Step",
            "spec": "3GPP TS 38.214 §5.2.2 / AMC",
            "formula": "SINR_eff = SINR_CQI - Δ_OLLA;   Δ_down = Δ_up × (BLER_target / (1 - BLER_target))\nFor 10% BLER_target: Δ_down = Δ_up / 9  (e.g., Δ_up = 1.0 dB ⇒ Δ_down = 0.111 dB)"
        },
        {
            "name": "3GPP 5G NR Approximate Peak Data Rate",
            "spec": "3GPP TS 38.306 §4.1.2",
            "formula": "R_max (Mbps) = 10^-6 × Σ_j [ v_Layers^(j) × Q_m^(j) × f^(j) × R_max × (N_PRB^(BW,μ) × 12 / T_s^μ) × (1 - OH^(j)) ]"
        },
        {
            "name": "Logical Channel Prioritization (LCP) Token Bucket",
            "spec": "3GPP TS 38.321 §5.4.3.1",
            "formula": "B_j = min(B_j + PBR_j × T_elapsed,  PBR_j × BSD_j)   [B_j can go negative after grant allocation]"
        },
        {
            "name": "Asynchronous DL HARQ Round-Trip Time (RTT)",
            "spec": "3GPP TS 38.213 §9.2.3",
            "formula": "T_RTT = K_0 (PDCCH→PDSCH) + K_1 (PDSCH→PUCCH HARQ-ACK) + T_proc,gNB + K_re-tx"
        },
        {
            "name": "Cross-Carrier Scheduling Slot Ratio & Prep Time",
            "spec": "3GPP TS 38.214 §5.1.2.1",
            "formula": "N_ratio = 2^(μ_PDSCH - μ_PDCCH);   T_prep ≥ N_{p,1} × T_slot^{min(μ_PDCCH, μ_PDSCH)};   CIF = 3 bits (up to 8 CCs)"
        }
    ],
    "nackStormDecisionTree": [
        {
            "step": "Step 1: Inspect PDSCH CRC in 0xB887 (NR5G MAC PDSCH Status)",
            "branchA": "CRC PASS at UE, yet gNodeB keeps retransmitting the same HARQ PID (NDI not toggled)? ⇒ Uplink Feedback Failure! The gNodeB is failing to decode PUCCH/PUSCH HARQ-ACK (interpreting DTX as NACK). Root cause: Uplink interference, PUCCH power control saturation, or Timing Advance drift.",
            "branchB": "CRC FAIL at UE on initial transmission and retransmissions? ⇒ Proceed to Step 2."
        },
        {
            "step": "Step 2: Correlate L1 SNR & Beam RSRP in 0xB97F (NR5G ML1 Searcher Measurement DB)",
            "branchA": "High SNR (> 20 dB) with 100% PDSCH BLER? ⇒ Link Adaptation / Precoding Mismatch! OLLA offset drifted or CSI-RS report is stale, forcing MCS 27 (256-QAM) on a channel supporting only MCS 16, or DM-RS port / TCI QCL-TypeD beam mismatch.",
            "branchB": "Sharp SNR / L1-RSRP drop (< 0 dB)? ⇒ Physical RF blockage, external interference, or Beam Failure Recovery (BFR) not triggered in time."
        },
        {
            "step": "Step 3: Audit RRC OTA Configuration in 0xB821 (NR5G RRC OTA Packet)",
            "branchA": "Check ServingCellConfig, pdsch-TimeDomainAllocationList (SLIV validity), and BWP-Downlink parameters.",
            "branchB": "In Carrier Aggregation, verify CrossCarrierSchedulingConfig CIF bit alignment and Type-1 vs Type-2 HARQ-ACK codebook cDAI/tDAI synchronization."
        },
        {
            "step": "Step 4: L1/L2 Real-Time Baseband Execution Telemetry (FAPI / O-DU)",
            "branchA": "Inspect baseband thread scheduling jitter and FAPI DL_TTI.request / TX_Data.request arrival timestamps.",
            "branchB": "If the L2 MAC thread missed the 380 µs slot deadline (at 30 kHz SCS), the L1 PHY transmits an empty/zeroed DMA buffer while sending a valid PDCCH DCI — causing 100% CRC failure at the UE despite perfect radio conditions!"
        }
    ],
    "candidateNarrative": {
        "title": "Executive Candidate Narrative, Thesis Defense & Positioning",
        "subtitle": "Tailored for Senior / Lead L2 MAC & Baseband Roles (Ericsson, Apple Munich, Nokia AirScale, Rohde & Schwarz, Qualcomm)",
        "triadPillars": [
            {
                "title": "Pillar 1: Production 3GPP L2 MAC Domain Mastery",
                "details": "5+ years at Samsung R&D Institute Bangalore (SRI-B) engineering commercial 4G LTE & 5G NR MAC Downlink schedulers, Inter-Site Carrier Aggregation over non-ideal backhaul, SCell activation/deactivation state machines, and HARQ/AMC loops deployed across Tier-1 global operators."
            },
            {
                "title": "Pillar 2: Hard Real-Time C/C++ & RTOS Systems Architecture",
                "details": "Deterministic sub-millisecond execution (< 1 ms TTI / 125–500 µs slot budgets), lock-free SPSC ring buffers with acquire/release atomics, 64-byte cache-line alignment (alignas(64)) eliminating false sharing, zero-copy DMA packet pools, and Linux PREEMPT_RT core pinning."
            },
            {
                "title": "Pillar 3: Real-Time ML in Baseband L2 (IISc M.Tech Unfair Advantage)",
                "details": "Designed and compiled a Gradient-Boosted Decision Tree (XGBoost) into a ~280 KB zero-allocation native C binary via Treelite executing in 0.42 ms inside the 1 ms MAC TTI loop — boosting Inter-Site CA PUCCH scheduling hit rate from 42% to 91% and cutting PUCCH waste by 9× (58% → 6.4%)."
            }
        ],
        "metricsReconciliation": [
            "Live Commercial Testbed (Resume Metric): 42% static baseline → 91% hit rate with deployed Treelite native C binary (9× PUCCH wastage reduction from 58% to 6.4%, 0.42 ms worst-case single-sample latency under bursty SCell traffic).",
            "Standardized 60-UE E500 Simulation (IISc Thesis Report Metric): 60% static baseline → 85% tuned XGBoost across 5 Resource Indices (0.25 ms inference latency under balanced traffic distributions)."
        ],
        "verbatimPitch": "\"In our initial commercial testbed experiments with severe bursty SCell traffic, the naive static baseline hit rate dropped to 42% due to high traffic variance, which our deployed Treelite native C binary raised to 91% with a 9× reduction in PUCCH wastage. In our standardized 60-UE E500 simulation documented in my IISc thesis report, under balanced traffic conditions, the static algorithm achieved a 60% baseline, which our tuned XGBoost model improved to 85% with an inference latency of just 0.25 ms across 5 Resource Indices—comfortably within the 1 ms TTI budget.\""
    },
    "actionableChecklist": [
        "Phase 1 (Daily 06:45 AM Spec Habit): Read 3GPP TS 38.211 §4.2 (Numerologies), TS 38.213 §9.2/§11 (HARQ Codebooks & Slot Formats), and TS 38.321 §5.3/§5.4/§6.1 (HARQ, LCP, MAC PDU).",
        "Phase 2 (Open-Source Baseband Code Trace): Trace openair2/LAYER2/NR_MAC_gNB/gNB_scheduler_dlsch.c (OAI) and lib/mac/mac_dl_processor.cc (srsRAN Project) to map spec clauses to C++ structs.",
        "Phase 3 (C++20/23 & Lock-Free Systems Sprint): Practice writing lock-free SPSC ring buffers, arena/pool allocators, custom unique_ptr/shared_ptr, and TS 38.321 MAC subheader encoders from memory.",
        "Phase 4 (Protocol Math & Calculation Drills): Work through SLIV encoding/decoding, Type-1 vs Type-2 cDAI/tDAI fault injection, full 5-step TBS calculation, and OLLA step-size convergence on paper.",
        "Phase 5 (Verbal Mock Defense): Rehearse Top 15 5G NR questions, Top C++ concurrency/memory questions, and the IISc Thesis 42%→91% vs 60%→85% pitch aloud until delivery is crisp and effortless."
    ],
    "targetEmployers": [
        {
            "company": "Ericsson (Bangalore/Noida India & Aachen/Frankfurt Germany)",
            "focus": "Cloud-RAN DU/CU in Linux C++, 5G Advanced MAC DL/UL Schedulers, Carrier Aggregation (up to 16 CCs), EN-DC / NR-DC, O-RAN 7-2x Split, DPDK & PREEMPT_RT.",
            "pitchAngle": "Emphasize Inter-Site Downlink CA over non-ideal backhaul, GTP-U flow control, multi-core deterministic C++ scheduling within sub-millisecond slot budgets, and 3GPP Rel-16/17 MAC feature ownership."
        },
        {
            "company": "Apple – Cellular Modem Firmware (Munich Silicon Design Center)",
            "focus": "In-house 5G/6G cellular baseband modem firmware (C/C++), UE-side L2 MAC/RLC/PDCP protocols, PHY-MAC interface, cDRX power saving, dynamic BWP switching.",
            "pitchAngle": "Emphasize UE/baseband MAC state machines, bitwise PDU serialization, zero-allocation memory pools, C++17/20 determinism, and deep Qualcomm QXDM / Viavi TM500 trace debugging."
        },
        {
            "company": "Nokia AirScale & Bell Labs (Munich & Ulm, Germany / Bangalore)",
            "focus": "AirScale Baseband L2 MAC/Scheduler software, SoC firmware, Open RAN O-DU, Massive MIMO beamforming schedulers (TCI states, CSI-RS).",
            "pitchAngle": "Emphasize gNodeB Proportional Fair / QoS scheduler pipelines, OLLA link adaptation, multi-carrier HARQ management, and ML-driven PUCCH resource optimization."
        },
        {
            "company": "Rohde & Schwarz (Munich Global HQ)",
            "focus": "CMX500 / CMW500 5G/6G protocol stack emulation engines, 3GPP TS 38.521 conformance testing, L1/L2 protocol dissection.",
            "pitchAngle": "Emphasize authoritative 3GPP specification compliance, Viavi TM500 multi-UE emulation, GDB core dump analysis, and cross-layer PHY-MAC timing verification."
        }
    ]
}

bundle = {
    "generatedAt": "2026-10-26",
    "cpp": cpp_data,
    "nr": nr_data,
    "nrQuestionBank": nr_qbank,
    "nrExtras": nr_extras
}

bundle_js_path = os.path.join(DATA_DIR, "handbook_bundle.js")
with open(bundle_js_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated comprehensive study handbook data bundle from C:\\GitHub\\Ubiverse\n")
    f.write("window.HANDBOOK_DATA = ")
    json.dump(bundle, f, ensure_ascii=False)
    f.write(";\n")

print(f"Successfully wrote {bundle_js_path} ({os.path.getsize(bundle_js_path):,} bytes)")
