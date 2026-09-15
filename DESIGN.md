# Macroplan — Design (QFD)

Need-driven design for the Macroplan app: a week-granular, learning-oriented view of committed Features rendered as an interactive web view from a source file. This document covers _what the system must do and what we build_; the vocabulary lives in [CONTEXT.md](CONTEXT.md) and the original-estimate baseline decision in [ADR-0001](docs/adr/0001-original-estimate-as-baseline.md). It is not a spec or a task list.

Strength weights used in matrices: **9** strong, **3** medium, **1** weak, blank none.

---

## House of Quality

```tikz
% =====================================================================
% QFD "House of Quality" preamble
% =====================================================================
% Usage:
%   \begin{document}
%   \begin{qfdhouse}
%     % WHATs at ({\qfdLeftEdge + 0.1}, {-\r + 0.5})
%     % Importance at ({-\qfdImpW/2}, {-\r + 0.5})
%     % HOWs rotated 90 at ({\c - 0.5}, 0.15)
%     % Relations in cells with [qfdrel/S], [qfdrel/M], [qfdrel/W]
%     % Roof correlations at (C-i-j)
%     % Perception markers at ({\qfdNH + (s+0.5)*\qfdCmpW/6}, {-\r + 0.5})
%     % Basement: target / difficulty / abs weight / rel weight, per HOW
%   \end{qfdhouse}
%   \end{document}
%
% NB: in node text, use $<$ / $>$ for less-than / greater-than under
% OT1 encoding; bare < and > render as Spanish ¡ ¿.
% =====================================================================

\usetikzlibrary{arrows.meta, positioning, shapes.geometric, shapes.misc, calc, fit, backgrounds}

% Toggles — flip before \begin{qfdhouse} to hide sections.
\newif\ifqfdshowroof          \qfdshowrooftrue
\newif\ifqfdshowbasement      \qfdshowbasementtrue
\newif\ifqfdshowcompetitive   \qfdshowcompetitivetrue
\newif\ifqfdshowlegend        \qfdshowlegendtrue
\newif\ifqfdshowimportance    \qfdshowimportancetrue
\newif\ifqfdshowcorrlegend    \qfdshowcorrlegendtrue
\newif\ifqfdshowevallegend    \qfdshowevallegendtrue
\newif\ifqfdshowtitle         \qfdshowtitletrue   % title block above the roof

% Dimensions — override before \begin{qfdhouse} to resize.
\def\qfdNW{5}           % number of WHATs (rows)
\def\qfdNH{5}           % number of HOWs (columns)
\def\qfdWhatW{4.0}      % width of WHATs column
\def\qfdImpW{0.9}       % width of importance column
\def\qfdCmpW{3}         % width of perception zone
\def\qfdHdrH{2.6}       % height of column-titles band
\def\qfdBasementN{4}    % number of basement rows

% Titles & labels — override before \begin{qfdhouse}.
\def\qfdWhatsTitle{Customer needs}
\def\qfdImpTitle{Imp.\ \%}
\def\qfdPerceptionTitle{Comparative evaluation}
\def\qfdPoorLabel{poor}
\def\qfdExcellentLabel{excellent}
\def\qfdAltOneLabel{Our product}    % highlighted in legend
\def\qfdAltTwoLabel{Competitor A}
\def\qfdAltThreeLabel{Competitor B}
\def\qfdRelTitle{Relation}
\def\qfdCorrTitle{Correlation}
\def\qfdEvalTitle{Evaluation}

% Title block above the roof — set both to name the house. Leave
% \qfdProjectTitle empty (default) to draw no title at all.
\def\qfdProjectTitle{}  % project / feature name (large, bold)
\def\qfdConcept{}       % concept in one sentence; \textbf{} the keywords

% Styles.
\tikzset{
  qfdthin/.style ={line width=0.35pt},
  qfdmed/.style  ={line width=0.7pt},
  qfdstrong/.style={circle, draw, fill=black,
                    minimum size=7pt, inner sep=0pt},
  qfdmod/.style  ={circle, draw,
                    minimum size=7pt, inner sep=0pt, line width=0.8pt},
  qfdweak/.style ={regular polygon, regular polygon sides=3, draw,
                    minimum size=8.5pt, inner sep=0pt, line width=0.7pt},
  qfdrel/.is choice,
  qfdrel/S/.style={qfdstrong},
  qfdrel/M/.style={qfdmod},
  qfdrel/W/.style={qfdweak},
  % Three perception-zone alternatives. Index 1 is emphasised.
  qfdalt1mk/.style={circle, draw, fill=black,
                    minimum size=6pt, inner sep=0pt, line width=1pt},
  qfdalt1ln/.style={line width=1.2pt},
  qfdalt2mk/.style={regular polygon, regular polygon sides=3, draw,
                    fill=black, minimum size=6pt, inner sep=0pt,
                    line width=0.7pt},
  qfdalt2ln/.style={line width=0.7pt, dashed},
  qfdalt3mk/.style={rectangle, draw, fill=black,
                    minimum size=5pt, inner sep=0pt, line width=0.7pt},
  qfdalt3ln/.style={line width=0.7pt, dotted},
}

% --- Grid lines for every zone. ---
\newcommand{\qfdDrawGrid}{%
  \foreach \c in {1,...,\qfdNHm} \draw[qfdthin] (\c, 0) -- (\c, -\qfdNW);
  \foreach \r in {1,...,\qfdNWm} \draw[qfdthin] (0, -\r) -- (\qfdNH, -\r);
  \foreach \r in {1,...,\qfdNWm}
    \draw[qfdthin] (\qfdLeftEdge, -\r) -- (0, -\r);
  \ifqfdshowroof
    \foreach \c in {1,...,\qfdNHm}
      \draw[qfdthin] (\c, 0) -- (\c, \qfdHdrH);
  \fi
  \ifqfdshowcompetitive
    \foreach \r in {1,...,\qfdNWm}
      \draw[qfdthin] (\qfdNH, -\r) -- (\qfdNH+\qfdCmpW, -\r);
  \fi
  \ifqfdshowbasement
    \foreach \r in {1,...,\qfdBasementN}
      \draw[qfdthin] (0, -\qfdNW-\r) -- (\qfdNH, -\qfdNW-\r);
    \foreach \c in {1,...,\qfdNHm}
      \draw[qfdthin] (\c, -\qfdNW) -- (\c, -\qfdNW-\qfdBasementN);
  \fi
}

% --- Roof: diagonal grid + named coordinates (C-i-j) for correlations. ---
\newcommand{\qfdDrawRoof}{%
  \ifqfdshowroof
    \foreach \k in {1,...,\qfdNHm} {%
      \pgfmathsetmacro{\rx}{(\k+\qfdNH)/2}
      \pgfmathsetmacro{\ry}{\qfdHdrH + (\qfdNH-\k)/2}
      \pgfmathsetmacro{\lx}{\k/2}
      \pgfmathsetmacro{\ly}{\qfdHdrH + \k/2}
      \draw[qfdthin] (\k, \qfdHdrH) -- (\rx, \ry);
      \draw[qfdthin] (\k, \qfdHdrH) -- (\lx, \ly);
    }%
    \draw[qfdmed] (0, \qfdHdrH)
       -- (\qfdNH/2, \qfdApexY) -- (\qfdNH, \qfdHdrH);
    \foreach \i in {1,...,\qfdNH}
      \foreach \k in {1,...,\qfdNH} {%
        \pgfmathtruncatemacro{\jj}{\i+\k}
        \ifnum\jj>\qfdNH\relax\else
          \pgfmathsetmacro{\xx}{\i + \k/2 - 0.5}
          \pgfmathsetmacro{\yy}{\qfdHdrH + \k/2}
          \coordinate (C-\i-\jj) at (\xx, \yy);
        \fi
      }%
  \fi
}

% --- Perception scale 0..5 + poor/excellent endpoints + zone title. ---
\newcommand{\qfdDrawScale}{%
  \ifqfdshowcompetitive
    \foreach \tk in {0,1,2,3,4,5} {%
      \pgfmathsetmacro{\tx}{\qfdNH + (\tk+0.5)*\qfdCmpW/6}
      \node[anchor=south, font=\scriptsize] at (\tx, 0.02) {\tk};
    }%
    \node[anchor=south, font=\scriptsize\bfseries, align=center]
         at ({\qfdNH + \qfdCmpW/2}, 0.7) {\qfdPerceptionTitle};
    \node[anchor=north, font=\scriptsize\itshape]
         at ({\qfdNH + 0.45}, -\qfdNW) {\qfdPoorLabel};
    \node[anchor=north, font=\scriptsize\itshape]
         at ({\qfdNH + \qfdCmpW - 0.45}, -\qfdNW) {\qfdExcellentLabel};
  \fi
}

% --- Importance title (left) and WHATs title (header band). ---
\newcommand{\qfdDrawZoneTitles}{%
  \ifqfdshowimportance
    \node[rotate=90, anchor=west, font=\footnotesize\bfseries]
         at ({-\qfdImpW/2}, 0.12) {\qfdImpTitle};
  \fi
  \node[font=\scriptsize\bfseries, align=center, text width=\qfdWhatW cm]
       at ({\qfdLeftEdge + \qfdWhatW/2},
           {\ifqfdshowroof \qfdHdrH/2 \else 0.6 \fi}) {\qfdWhatsTitle};
}

% --- Title + concept subtitle, centred above the roof apex. ---
\newcommand{\qfdDrawTitle}{%
  \ifqfdshowtitle
    \ifx\qfdProjectTitle\empty\else
      \pgfmathsetmacro{\qfdTitleX}{\qfdNH/2}
      \pgfmathsetmacro{\qfdTitleY}{\ifqfdshowroof \qfdApexY \else \qfdHdrH \fi + 0.9}
      \pgfmathsetmacro{\qfdSubW}{\qfdNH + 2}    % pre-computed (braces don't do arithmetic)
      \node[anchor=south, font=\large\bfseries, align=center]
           at (\qfdTitleX, \qfdTitleY) {\qfdProjectTitle};
      \ifx\qfdConcept\empty\else
        \node[anchor=north, font=\footnotesize\itshape, align=center,
              text width=\qfdSubW cm]
             at (\qfdTitleX, {\qfdTitleY - 0.1}) {\qfdConcept};
      \fi
    \fi
  \fi
}

% --- Outer frames around each zone. ---
\newcommand{\qfdDrawFrames}{%
  \begin{scope}[qfdmed]
    \draw (\qfdLeftEdge, 0) rectangle (\qfdNH, -\qfdNW);
    \ifqfdshowimportance \draw (-\qfdImpW, 0) -- (-\qfdImpW, -\qfdNW); \fi
    \draw (0, 0) -- (0, -\qfdNW);
    \ifqfdshowroof
      \draw (0, 0) rectangle (\qfdNH, \qfdHdrH); \fi
    \ifqfdshowbasement
      \draw (0, -\qfdNW) rectangle (\qfdNH, -\qfdNW-\qfdBasementN); \fi
    \ifqfdshowcompetitive
      \draw (\qfdNH, 0) rectangle (\qfdNH+\qfdCmpW, -\qfdNW); \fi
  \end{scope}
}

% --- Legend on the right (Relations / Correlations / Evaluation). ---
\newcommand{\qfdDrawLegend}{%
  \ifqfdshowlegend
    \pgfmathsetmacro{\qfdLegX}{%
      \qfdNH + \ifqfdshowcompetitive \qfdCmpW + 0.7 \else 0.7 \fi}
    \pgfmathsetmacro{\qfdLegBottom}{%
      -2.05
      \ifqfdshowroof    \ifqfdshowcorrlegend - 2.55 \fi \fi
      \ifqfdshowcompetitive \ifqfdshowevallegend - 2.20 \fi \fi}
    \pgfmathsetmacro{\qfdLegY}{\qfdHdrH - 0.4}
    \begin{scope}[shift={(\qfdLegX, \qfdLegY)}]
      \draw[qfdmed, rounded corners=2pt]
        (-0.15, 0.4) rectangle (4.5, \qfdLegBottom);
      % Relations
      \node[anchor=west, font=\footnotesize\bfseries] at (0, 0.1)
        {\qfdRelTitle};
      \draw[qfdthin] (0, -0.15) -- (4.35, -0.15);
      \node[qfdstrong] at (0.22, -0.5)  {};
        \node[anchor=west] at (0.5, -0.5)  {Strong (9)};
      \node[qfdmod]    at (0.22, -0.95) {};
        \node[anchor=west] at (0.5, -0.95) {Medium (3)};
      \node[qfdweak]   at (0.22, -1.4)  {};
        \node[anchor=west] at (0.5, -1.4)  {Weak (1)};
      % Correlations (roof)
      \ifqfdshowroof \ifqfdshowcorrlegend
        \node[anchor=west, font=\footnotesize\bfseries] at (0, -2.10)
          {\qfdCorrTitle};
        \draw[qfdthin] (0, -2.35) -- (4.35, -2.35);
        \node[anchor=west] at (0, -2.70) {{$+\!+$}\quad very positive};
        \node[anchor=west] at (0, -3.05) {{$+$\phantom{$+$}}\quad positive};
        \node[anchor=west] at (0, -3.40) {{$-$\phantom{$-$}}\quad negative};
        \node[anchor=west] at (0, -3.75) {{$-\!-$}\quad very negative};
      \fi \fi
      % Evaluation (3 alternatives)
      \ifqfdshowcompetitive \ifqfdshowevallegend
        \pgfmathsetmacro{\qfdEvalTop}{%
          -2.10 \ifqfdshowroof\ifqfdshowcorrlegend - 2.55 \fi\fi}
        \node[anchor=west, font=\footnotesize\bfseries]
          at (0, \qfdEvalTop) {\qfdEvalTitle};
        \pgfmathsetmacro{\qfdEvalSep}{\qfdEvalTop - 0.25}
        \draw[qfdthin] (0, \qfdEvalSep) -- (4.35, \qfdEvalSep);
        \pgfmathsetmacro{\qfdLegA}{\qfdEvalTop - 0.55}
        \draw[qfdalt1ln] (0.05, \qfdLegA) -- (0.45, \qfdLegA);
          \node[qfdalt1mk] at (0.25, \qfdLegA) {};
          \node[anchor=west, font=\bfseries] at (0.55, \qfdLegA)
            {\qfdAltOneLabel};
        \pgfmathsetmacro{\qfdLegB}{\qfdEvalTop - 0.95}
        \draw[qfdalt2ln] (0.05, \qfdLegB) -- (0.45, \qfdLegB);
          \node[qfdalt2mk] at (0.25, \qfdLegB) {};
          \node[anchor=west] at (0.55, \qfdLegB) {\qfdAltTwoLabel};
        \pgfmathsetmacro{\qfdLegC}{\qfdEvalTop - 1.35}
        \draw[qfdalt3ln] (0.05, \qfdLegC) -- (0.45, \qfdLegC);
          \node[qfdalt3mk] at (0.25, \qfdLegC) {};
          \node[anchor=west] at (0.55, \qfdLegC) {\qfdAltThreeLabel};
      \fi \fi
    \end{scope}
  \fi
}

% --- The environment users wrap their content in. ---
\newenvironment{qfdhouse}{%
  \begin{tikzpicture}[x=1cm, y=1cm, font=\scriptsize,
                      line cap=round, line join=round]
  \ifqfdshowimportance
    \pgfmathsetmacro{\qfdLeftEdge}{-\qfdWhatW-\qfdImpW}
  \else
    \pgfmathsetmacro{\qfdLeftEdge}{-\qfdWhatW}
  \fi
  \pgfmathsetmacro{\qfdApexY}{\qfdHdrH + \qfdNH/2}
  \pgfmathtruncatemacro{\qfdNHm}{\qfdNH - 1}
  \pgfmathtruncatemacro{\qfdNWm}{\qfdNW - 1}
  \qfdDrawGrid
  \qfdDrawRoof
  \qfdDrawScale
  \qfdDrawZoneTitles
  \qfdDrawTitle
}{%
  \qfdDrawFrames
  \qfdDrawLegend
  \end{tikzpicture}%
}
% --- Macroplan house: 6 WHATs, 8 HOWs, no competitor zone ---
\def\qfdNW{6}
\def\qfdNH{8}
\def\qfdWhatW{4.6}
\def\qfdHdrH{3.5}       % taller header band — long HOW labels (~24 chars)
\def\qfdWhatsTitle{Needs (WHATs)}
\def\qfdImpTitle{Weight}
\def\qfdProjectTitle{Macroplan}
\def\qfdConcept{A \textbf{week-granular} plan view that holds every
  \textbf{Feature} honest against its \textbf{Original Estimate}, groups them
  by \textbf{Area}, and turns the slips into captured \textbf{Learnings}.}
\qfdshowcompetitivefalse

\begin{document}
\begin{qfdhouse}
  % WHATs + weights
  \pgfmathsetmacro{\qfdWhatTextW}{\qfdWhatW - 0.2}
  \foreach \r/\t in {%
    1/{N1 Honest record vs Original Estimate},
    2/{N2 Capture Learnings},
    3/{N4 Fast authoring},
    4/{N3 Milestone risk visible},
    5/{N6 Areas keep disciplines distinct},
    6/{N5 Shareable view}}
    \node[anchor=west, font=\scriptsize,
          text width=\qfdWhatTextW cm, align=left]
      at ({\qfdLeftEdge + 0.1}, {-\r + 0.5}) {\t};
  \foreach \r/\imp in {1/10, 2/8, 3/8, 4/7, 5/6, 6/5}
    \node[font=\scriptsize] at ({-\qfdImpW/2}, {-\r + 0.5}) {\imp};

  % HOWs (rotated)
  \foreach \c/\t in {%
    1/{F1 Legible render},
    2/{F2 Classify on-time/late},
    3/{F3 Instant edit-to-view},
    4/{F4 Local CRUD},
    5/{F5 Easy Learning},
    6/{F6 Milestone render},
    7/{F7 Image export},
    8/{F8 Area banding}}
    \node[rotate=90, anchor=west, font=\scriptsize]
      at ({\c - 0.5}, 0.15) {\t};

  % Relations
  \node[qfdrel/S] at ({1 - 0.5}, {-1 + 0.5}) {};
  \node[qfdrel/S] at ({2 - 0.5}, {-1 + 0.5}) {};
  \node[qfdrel/W] at ({3 - 0.5}, {-1 + 0.5}) {};
  \node[qfdrel/W] at ({4 - 0.5}, {-1 + 0.5}) {};
  \node[qfdrel/W] at ({6 - 0.5}, {-1 + 0.5}) {};
  \node[qfdrel/W] at ({8 - 0.5}, {-1 + 0.5}) {};

  \node[qfdrel/M] at ({1 - 0.5}, {-2 + 0.5}) {};
  \node[qfdrel/S] at ({5 - 0.5}, {-2 + 0.5}) {};

  \node[qfdrel/W] at ({1 - 0.5}, {-3 + 0.5}) {};
  \node[qfdrel/S] at ({3 - 0.5}, {-3 + 0.5}) {};
  \node[qfdrel/S] at ({4 - 0.5}, {-3 + 0.5}) {};
  \node[qfdrel/M] at ({5 - 0.5}, {-3 + 0.5}) {};
  \node[qfdrel/W] at ({6 - 0.5}, {-3 + 0.5}) {};

  \node[qfdrel/M] at ({1 - 0.5}, {-4 + 0.5}) {};
  \node[qfdrel/M] at ({2 - 0.5}, {-4 + 0.5}) {};
  \node[qfdrel/S] at ({6 - 0.5}, {-4 + 0.5}) {};

  \node[qfdrel/M] at ({1 - 0.5}, {-5 + 0.5}) {};
  \node[qfdrel/M] at ({4 - 0.5}, {-5 + 0.5}) {};
  \node[qfdrel/W] at ({7 - 0.5}, {-5 + 0.5}) {};
  \node[qfdrel/S] at ({8 - 0.5}, {-5 + 0.5}) {};

  \node[qfdrel/M] at ({1 - 0.5}, {-6 + 0.5}) {};
  \node[qfdrel/S] at ({7 - 0.5}, {-6 + 0.5}) {};
  \node[qfdrel/M] at ({8 - 0.5}, {-6 + 0.5}) {};

  % Roof correlations
  \node[font=\scriptsize] at (C-1-2) {$+$};
  \node[font=\scriptsize] at (C-1-3) {$-$};
  \node[font=\scriptsize] at (C-3-4) {$+\!+$};
  \node[font=\scriptsize] at (C-2-4) {$+$};
  \node[font=\scriptsize] at (C-1-7) {$-$};
  \node[font=\scriptsize] at (C-1-8) {$-$};
  \node[font=\scriptsize] at (C-4-8) {$+$};
  \node[font=\scriptsize] at (C-6-8) {$-$};
  \node[font=\scriptsize] at (C-7-8) {$+$};

  % Basement: target / difficulty / abs / rel
  \foreach \c/\tgt/\diff/\abs/\rel in {%
    1/{state $\leq$1s}/4/176/23,
    2/{100\%}/2/111/14,
    3/{$\leq$1s}/2/82/11,
    4/{1 block}/2/100/13,
    5/{1 field}/1/96/12,
    6/{line@wk}/3/81/10,
    7/{1-click}/3/51/7,
    8/{0 rows}/3/79/10} {
    \node[font=\scriptsize] at ({\c - 0.5}, {-\qfdNW - 0.5}) {\tgt};
    \node[font=\scriptsize] at ({\c - 0.5}, {-\qfdNW - 1.5}) {\diff};
    \node[font=\scriptsize] at ({\c - 0.5}, {-\qfdNW - 2.5}) {\abs};
    \node[font=\scriptsize\bfseries] at ({\c - 0.5}, {-\qfdNW - 3.5}) {\rel};
  }
\end{qfdhouse}
\end{document}
```

Basement rows (top→bottom): **target · difficulty (1–5) · absolute weight · relative weight %**.

---

## 1. Needs — the WHATs

| ID  | Need                                                                                         | Weight | Source                                                             |
| --- | -------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------ |
| N1  | See at a glance where every Feature stands against its Original Estimate — the honest record |   10   | brief + [CONTEXT.md](CONTEXT.md)                                   |
| N2  | Turn estimation misses into captured Learnings for next time                                 |   8    | brief + [CONTEXT.md](CONTEXT.md)                                   |
| N4  | Author & update the whole plan fast during a weekly review                                   |   8    | brief                                                              |
| N3  | Know whether external Milestones are at risk                                                 |   7    | brief + [CONTEXT.md](CONTEXT.md)                                   |
| N6  | Read a plan that spans several disciplines without losing which one owns each Feature        |   6    | brief + [ADR-0003](docs/adr/0003-area-is-a-container-not-a-tag.md) |
| N5  | Hand stakeholders a shareable read-only view                                                 |   5    | brief                                                              |

## 2. Functions — the HOWs

| ID  | Function                                                                         | Dir | Target (now)                                                                                                                                          |
| --- | -------------------------------------------------------------------------------- | :-: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Render the plan legibly — bars, symbols, status colors, now-line, hover comments |  →  | reader IDs any Feature's state (on-time/late/overdue/slip-count) in ≤1s; Feature name + week axis never lost even when the plan exceeds the viewport  |
| F2  | Classify each Delivery on-time/late against the Original Estimate                |  →  | 100% correct per ADR-0001; markers land on the right Week                                                                                             |
| F3  | Reflect a source edit in the rendered view                                       |  ↓  | ≤1s (live reload while authoring)                                                                                                                     |
| F4  | Add / edit / remove a Feature with a single local edit                           |  ↓  | one contiguous block per op; no ripple edits — Weeks auto-layout, Milestones reference Features by name                                               |
| F5  | Make it easy to attach an optional Learning to a delivered Feature               |  ↓  | one optional field; rendered in the trailing column when present, blank otherwise                                                                     |
| F6  | Render a Milestone and flag its unmet required Features                          |  →  | vertical line at the correct Week; unmet required Features identifiable                                                                               |
| F7  | Export the rendered plan as a shareable image (clipboard + download)             |  →  | one click → PNG on clipboard and/or downloaded; fully client-side, no backend                                                                         |
| F8  | Group Features into Area bands without displacing the timeline                   |  →  | zero added rows; ≤2rem horizontal cost (under one `--wk` column); Area label adjacent to every row of its band; Now line and Milestone lines unbroken |

## 3. Cascade — Needs → Functions → How → Components

- **N1** See where every Feature stands vs. its Original Estimate — the honest record _W:10_
  - **F1** Render the plan legibly (incl. at scale) _Dir→ reader IDs a state ≤1s; name + axis never lost_
    - **How**: DOM rendering with CSS Grid (symbols are the visual vocabulary _inside_ cells; layout is real DOM) — chosen over a preformatted monospace text block, which can't pin a column on scroll. See T1.
      - **Component**: **C3 Grid renderer** — bars (`┣━`), markers (`◯△◉▲`), status colors, Now line, sticky name column + sticky week-header row, hover tooltips for status notes
- **N2** Turn estimation misses into captured Learnings _W:8_
  - **F5** Make it easy to attach an optional Learning to a delivered Feature _Dir↓ one optional field_
    - **How**: a single optional `learning` field on a Feature block; rendered in a persistent trailing column when present
      - **Component**: C3 (trailing Learning column), C1 (TOML field)
- **N4** Author & update the whole plan fast during a weekly review _W:8_
  - **F4** Add / edit / remove a Feature with a single local edit _Dir↓ one block per op, no ripple_
    - **How**: TOML `[[feature]]` / `[[milestone]]` blocks keyed by date literals; renderer derives Weeks & marker placement so edits never ripple. See T2.
      - **Component**: **C1 TOML source + parser** (smol-toml) → Plan model
  - **F3** Reflect a source edit in the view _Dir↓ ≤1s_
    - **How**: in-app split editor, re-parse on every keystroke (instant); autosave to localStorage. Chosen over Vite-HMR-on-file (needs a running toolchain) and load-file-only (slow loop). See T3.
      - **Component**: **C4 Split editor** (editor pane + Vue reactivity)
- **N3** Know whether external Milestones are at risk _W:7_
  - **F6** Render a Milestone and flag its unmet required Features _Dir→ correct Week; unmet identifiable_
    - **How**: `[[milestone]]` references Features by name; renderer draws a vertical line at the milestone Week and marks which required Features are undelivered
      - **Component**: C2 (membership + unmet computation), C3 (vertical line overlay)
- **N5** Hand stakeholders a shareable read-only view _W:5_
  - **F7** Export the rendered plan as a shareable image _Dir→ one click → PNG_
    - **How**: client-side DOM-to-PNG (html-to-image) → clipboard + download. Chosen over hosting a URL, which has no data unless the source is also shipped (local-first tool). See T1, T4.
      - **Component**: **C6 Image exporter**
- **N6** Read a plan that spans several disciplines without losing which one owns each Feature _W:6_
  - **F8** Group Features into Area bands without displacing the timeline _Dir→ zero added rows; ≤2rem; lines unbroken_
    - **How**: a left gutter cell per band, spanning its Features (`grid-row: span N`), label rotated 90° — chosen over a full-width band header row, which adds a row per Area and breaks the Now / Milestone lines. See T7.
      - **Component**: C3 (gutter column, sticky alongside the name column)
    - **How**: banding derived in the pure model — `buildPlan` stable-sorts rows by first appearance of Area (ungrouped first) and emits `bands: {area?, start, span}[]` alongside the flat `rows`. Chosen over grouping in the renderer (logic in the least testable component) and over nesting rows inside bands (the index-addressed render matrix would flatten them again).
      - **Component**: C2 (band derivation), C1 (optional `area` key on `[[feature]]`)
    - **How**: a Feature carries at most one Area — a container, not a tag. See T6 / [ADR-0003](docs/adr/0003-area-is-a-container-not-a-tag.md).
- **F2** Classify each Delivery on-time/late vs the Original Estimate _Dir→ 100% correct per ADR-0001_ (serves N1)
  - **How**: pure derivation in the Plan model — compare Delivery Week to the Original Estimate Week; never to a Re-estimate
    - **Component**: **C2 Plan model** — derives contiguous Monday Weeks, classifies markers, computes Milestone membership

### Components

| ID  | Component                                                                                                           | Realises           | ADR                |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------ |
| C1  | TOML source + parser (smol-toml) → Plan model — incl. the optional `area` key                                       | F4, F8, feeds F2   | ADR-0002           |
| C2  | Plan model — Week derivation, on-time/late classification, Milestone membership, Area banding                       | F2, F6, F8         | ADR-0001, ADR-0003 |
| C3  | Grid renderer (Vue + CSS Grid) — bars, symbols, colors, Now line, sticky panes, hover, Learning column, Area gutter | F1, F5, F6, F8     | —                  |
| C4  | Split editor — parse-on-keystroke, localStorage autosave                                                            | F3                 | ADR-0002           |
| C5  | Plan library — named Macroplans in localStorage, switch/CRUD, Import/Export .toml                                   | scope, persistence | ADR-0002           |
| C6  | Image exporter (html-to-image) — PNG to clipboard + download                                                        | F7                 | —                  |

## 4. House — Needs × Functions

Cells: link strength (9 strong / 3 medium / 1 weak / blank none). Σ = `Σ(weight × strength)`.

|           | F1  | F2  | F3  | F4  | F5  | F6  | F7  | F8  |
| --------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| N1 (10)   |  9  |  9  |  1  |  1  |     |  1  |     |  1  |
| N2 (8)    |  3  |     |     |     |  9  |     |     |     |
| N4 (8)    |  1  |     |  9  |  9  |  3  |  1  |     |     |
| N3 (7)    |  3  |  3  |     |     |     |  9  |     |     |
| N6 (6)    |  3  |     |     |  3  |     |     |  1  |  9  |
| N5 (5)    |  3  |     |     |     |     |     |  9  |  3  |
| **Σ**     | 176 | 111 | 82  | 100 | 96  | 81  | 51  | 79  |
| **Rel %** | 23  | 14  | 11  | 13  | 12  | 10  |  7  | 10  |

**Top engineering priorities:** **F1 (render, 23%)** and **F2 (classify, 14%)** carry the most need-value — together they _are_ N1, the anchor need, so the grid renderer and the Plan-model classifier deserve the most care. **F5 (15%)** ranks third despite a single need because it is the _sole_ driver of N2 (weight 8) — under-investing in frictionless Learning capture silently abandons the learning need. The authoring pair **F3/F4** matter as a unit. **F8 (Area banding, 10%)** lands mid-table: it is the sole driver of N6 but reinforces nothing else strongly. Note where N6's weight actually went — **F1 rose 158→176** and **F4 82→100**, because grouping is _read_ through the renderer and _authored_ through the same local edit as every other field. The new need mostly reinforces functions we already had; F8 is the smaller half of serving it. **F7 (7%)** is genuinely a nice-to-have; keep it cheap. (Note: this importance lens differs from §7's risk lens, where F2 ranks first as the hard correctness gate.)

## 5. Roof — Function × Function tradeoffs

`◎` strong reinforce · `○` mild reinforce · `×` mild conflict · `⊗` strong conflict.

|        | F1  | F2  | F3  | F4  | F5  | F6  | F7  | F8  |
| ------ | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **F1** |  —  |  ○  |  ×  |     |     |     |  ×  |  ×  |
| **F2** |     |  —  |     |  ○  |     |     |     |     |
| **F3** |     |     |  —  |  ◎  |     |     |     |     |
| **F4** |     |     |     |  —  |     |     |     |  ○  |
| **F5** |     |     |     |     |  —  |     |     |     |
| **F6** |     |     |     |     |     |  —  |     |  ×  |
| **F7** |     |     |     |     |     |     |  —  |  ○  |
| **F8** |     |     |     |     |     |     |     |  —  |

**Conflicts that actually shape the design:**

- **F1 × F7 (×).** The richer F1's _hover-only_ content, the more an exported image (F7) loses. Mitigation: keep the status _color_ always-visible; only the note is hover-only. Owned by tension in §8.
- **F1 × F3 (×).** A heavier render (sticky panes, many cells) can slow the ≤1s reflect loop. Mitigation in §7: debounce / parse only changed blocks.
- **F3 ◎ F4.** Instant reflect + local ripple-free edits reinforce strongly — together they _are_ fast authoring (N4). Invest in them as a pair.
- **F1 × F8 (×).** The Area gutter spends horizontal room that the week columns want, and every rem left of the grid is a rem not showing the timeline. Mitigation: rotate the label so the gutter stays ≤2rem — under one week column — and make it sticky so it survives horizontal scroll rather than being re-read.
- **F6 × F8 (×).** The milestone overlay is positioned by absolute column math against `NAME_W`; inserting a gutter shifts that origin, and a stale constant misplaces milestone lines by exactly the gutter width — a wrong-week line, which is an F6 correctness failure, not a cosmetic one. Mitigation: one shared constant, and a test asserting a milestone line lands on its week in a plan _with_ Areas.
- **F4 ○ F8.** Filing is one key in the block you're already editing, and banding makes the right place to add a Feature obvious — grouping helps authoring rather than taxing it.
- **F7 ○ F8.** A grouped plan explains itself in a screenshot: the exported PNG gains the discipline labels for free, which is the cheapest win N5 has had.
- **F2 ○ F4.** TOML's explicit date literals feed reliable classification — structured source _helps_ correctness (this is why the earlier "terse-vs-robust" tension dissolved once we chose TOML over a DSL).

## 6. Function → Component map

Strength of each Component in realising each Function (9/3/1/blank). Component list and ADR anchors are in §3.

|        | C1  | C2  | C3  | C4  | C5  | C6  |
| ------ | :-: | :-: | :-: | :-: | :-: | :-: |
| **F1** |     |  3  |  9  |     |     |     |
| **F2** |  3  |  9  |     |     |     |     |
| **F3** |  3  |     |     |  9  |     |     |
| **F4** |  9  |     |     |  3  |     |     |
| **F5** |  3  |     |  9  |     |     |     |
| **F6** |     |  9  |  3  |     |     |     |
| **F7** |     |     |  3  |     |     |  9  |
| **F8** |  3  |  9  |  9  |  1  |     |     |

**C3 (Grid renderer)** and **C2 (Plan model)** anchor four functions each once F8 lands — they're the load-bearing components and the most important to get right and test hard. F8 is the first function to lean on _both_ at full strength, which is why its two halves are kept apart: derivation (stable sort, band spans) in C2 where it is unit-testable, and nothing but placement in C3.

## 7. Critical performance budget

| Rank | Function | Target                                            | Watched on                                                                                                                | If we miss it                                                                                                                          |
| ---- | -------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | F2       | 100% correct on-time/late vs Original Estimate    | unit tests over sample plans (incl. multi-slip, deliver-early, overdue)                                                   | classification is the product — block release; it's pure logic, so a failing test is a hard stop                                       |
| 2    | F1       | reader IDs a state ≤1s; legible past the viewport | manual review on a 30-feature / 26-week sample; check sticky panes                                                        | drop hover-only data into always-visible cells; simplify symbol styling                                                                |
| 3    | F3       | ≤1s edit→view                                     | eyeball on keystroke with a large plan                                                                                    | debounce parse; parse only changed blocks                                                                                              |
| 4    | F7       | one-click PNG, faithful to on-screen              | manual export of a real plan; diff against screen                                                                         | fall back to download-only if clipboard API is flaky; document "what you see is what exports"                                          |
| 5    | F8       | zero added rows; ≤2rem gutter; lines unbroken     | render a 3-Area sample incl. a single-Feature Area and an ungrouped band; assert a milestone line still lands on its week | fall back to a horizontal label in a wider gutter; last resort, a band header row — accepting the added rows and the broken date lines |

## 8. Tradeoffs — Got / Paid / ADR

| ID  | Tradeoff                                         | Got                                                                                 | Paid                                                                    | ADR      |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| T1  | DOM/CSS Grid render over monospace text block    | sticky panes, real colors, hover, image export                                      | can't paste the plan as plain text; more layout code                    | —        |
| T2  | TOML over a bespoke terse DSL (and over YAML)    | robustness, native date literals, no parser to maintain, forgiving for a non-expert | verbose per Feature; source doesn't _look like_ the plan                | ADR-0002 |
| T3  | In-app split editor over Vite-HMR-on-file        | instant loop, no toolchain for readers, works from static build                     | plan isn't a plain repo file by default (mitigated by Import/Export)    | ADR-0002 |
| T4  | Image export over hosted URL                     | no data-hosting problem, paste into Slack/decks                                     | snapshot loses hover content (status notes)                             | —        |
| T5  | In-app plan library over single-document         | switch plans without file juggling                                                  | list/CRUD UI, naming, localStorage to manage                            | ADR-0002 |
| T6  | Area as a container over many-to-many tags       | clean row bands, one honest row per Feature, no badge scheme                        | a Feature can't sit in two Areas; filing is sometimes an arbitrary call | ADR-0003 |
| T7  | Left gutter with row-span over a band header row | zero added rows, label beside every row, Now/Milestone lines stay unbroken          | ~2rem of width; rotated text; degrades for a single-Feature Area        | —        |

### Tensions being watched (unresolved by design)

- **Hover content vanishes in the exported image (F1↔F7).** For now we accept it: the colored status dot is always visible; only the _note_ is lost. **Trigger to revisit:** if shared snapshots regularly need the notes, add an "expand notes inline before export" toggle.
- **localStorage is the only live store (durability).** Accepted because Import/Export .toml is the durable, git-trackable backup. **Trigger to revisit:** first time a plan is lost, or when multi-device editing is needed → consider file-system-access API or a sync backend.
- **No fold, and therefore no per-Area filter.** Collapsing a band and showing only one Area are the same mechanism — filtering _is_ folding everything else — so neither is built. Fold has nowhere honest to persist: the `.toml` is the source of truth (ADR-0002) and a display preference does not belong in a portable format, which would leave it resetting on every reload. **Trigger to revisit:** the first time an Area has to be presented on its own to a stakeholder → build fold with state in localStorage beside the Library, and take the filter for free.
- **No multiplayer / real-time collaboration (v1).** Deliberately single-user, local-first per ADR-0002. A future version may add a **backend + database with a CRDT layer syncing edits to the same TOML** (the format and the pure Plan-model derivation are chosen to not block this). **Trigger to revisit:** when two people need to edit one Macroplan at the same time → spike a CRDT (e.g. Yjs) over the TOML document, behind the existing in-app editor.

## 9. Inconsistencies spotted and fixed

- **A proposed "keep names pinned while scrolling" function was a solution, not a function.** It named sticky panes (a How) and an outcome already in N1. Folded legibility-at-scale into F1's target; sticky panes became a How under F1. (It briefly held the id F8, now owned by Area banding — the discarded id was reused deliberately, not by accident.)
- **F5 over-specified coverage.** Originally "Learning on 100% of delivered rows"; corrected — a Learning is _optional_, the function is low-friction capture, not coverage.
- **F7 assumed hosting.** Originally "ship as a static hosted artifact"; a hosted URL has no data for a local-first file-based tool. Reframed to client-side image export, which actually serves N5 better.
- **F4 conflated terseness with ergonomics.** Originally "~1 feature = 1 line"; the real property for N4 is _local, ripple-free_ CRUD. Reframed; terseness target dropped (TOML is not 1-line and that's fine).
- **CONTEXT.md asserted the opposite of this feature.** It read "There is no grouping/workstream concept" — true when written, now deliberately reversed. Rewritten, with ADR-0003 recording why the reversal is a container rather than tags.
- **`track` was the obvious name and is unusable.** Status already owns `on-track` / `off-track`, so "off-track in the Payments track" would be the sentence. Recorded in CONTEXT.md's avoid list with the reason, so it doesn't get re-proposed.
- **`buildPlan` stops mirroring source order.** `rows` was `raw.features.map(...)`, index-parallel with the file; banding makes it a stable sort by first-appearance of Area. Nothing depends on the old invariant (Milestones join by name, export re-serializes from the raw model) — named here because it is the kind of quiet break that bites later.

---

## How to keep this honest

- When a new ADR lands → add its components to §3/§Components and re-score affected rows.
- When a spike / measurement returns numbers → update §7 `Target` / `Watched on`.
- WHATs (§1) change rarely; HOWs (§2) change per release; the cascade (§3) is recomputed when either side changes.
- If a section becomes empty after edits, delete it — empty sections lie.
