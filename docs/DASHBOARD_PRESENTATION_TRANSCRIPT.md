# Revenue Decomposition Dashboard — Presentation Transcript

*Meeting script for presenting the dashboard to stakeholders. Walk through each section and explain every driver with practical examples.*

---

## Opening

**Presenter:** Hello everyone. Today I'll walk you through our Revenue Decomposition dashboard. This is an FP&A bridge tool that breaks down the difference between planned and actual revenue so we can see exactly why we're over or under plan.

The dashboard connects to a Google Sheet, so the figures you see are live data. Let me show you around.

---

## 1. Layout and Navigation

**Presenter:** On the left you’ll see the sidebar. Here you can:

- Switch between **Existing Clients** and **New Clients** — revenue is split by these two segments.
- Choose the **month** — we currently have data for January and February.
- Select the **view type**: monthly, quarterly cumulative, or annual cumulative. For a single month, we usually keep it on monthly.

Once you’ve selected the segment and period, the rest of the dashboard updates.

---

## 2. Performance Cards (Top Row)

**Presenter:** The first thing you see is the four KPI cards:

1. **Planned Recognized Revenue** — what we expected to recognize in the period.
2. **Actual Recognized Revenue** — what we actually recognized.
3. **Variance (Actual minus Plan)** — the absolute difference. Green means we’re over plan, red means we’re under.
4. **Variance %** — the same gap expressed as a percentage of plan.

These give us the high-level view: how much we beat or missed plan, and by what percentage.

---

## 3. The Variance Bridge (Waterfall Chart)

**Presenter:** The main chart is the variance bridge, or waterfall. It answers the question: *how do we get from Plan to Actual?*

We start with **Plan** on the left and end with **Actual** on the right. In between, each bar represents a **driver** — a factor that either adds to or subtracts from revenue.

The drivers are:

- **Plan** — starting point
- **Fixed fee difference**
- **Volume**
- **Price**
- **Timing**
- **Unknown churn**
- **FX**
- **Residual**
- **Actual** — end point

You can **hover over a driver bar** to see a tooltip with the top three positive and top three negative contributors.

If you **click a driver bar**, a pop-up opens with the full client-level breakdown from our source data. That helps you drill into which clients or contracts are driving each effect.

---

## 4. What Each Driver Means (Explained with Examples)

### Fixed fee difference

**Presenter:** This is the impact of fixed fees — flat amounts we charge regardless of volume — being different from plan.

**Example:** We planned a fixed fee of £50k for Client A but invoiced £45k because of a renegotiation. That £5k shortfall appears as a negative Fixed fee difference. Conversely, if we raised a fixed fee above plan, we’d see a positive impact here.

---

### Volume

**Presenter:** Volume is about transaction count. We expected a certain number of transactions; we actually had more or fewer. More volume typically means more variable revenue; less volume means less.

**Example:** We planned 1 million transactions for Client B at £0.05 each. Actual was 1.2 million. That 200k extra transactions at £0.05 drives roughly £10k more revenue. That shows up as a positive Volume bar. If volumes fall, we’d see a negative Volume impact.

---

### Price

**Presenter:** Price is the per-unit or per-transaction price. Same volume, but higher or lower price than plan.

**Example:** For Client C we planned an average price of 4 pence per transaction. Actual was 6 pence. The extra 2 pence per transaction, applied across the same volume, increases revenue — a positive Price impact. Price negotiations or discounts would reduce the realized price and appear as negative.

---

### Timing

**Presenter:** Timing is about when revenue is recognized. Delays push revenue into later periods; accelerations bring it forward.

**Example:** Client D was supposed to go live in January. Implementation slipped to February, so January revenue is lower than plan and February higher. In January we’d see a negative Timing effect; in February we’d see a positive one. It’s a shift in time, not necessarily a change in total contract value.

---

### Unknown churn

**Presenter:** This captures revenue lost from clients who churned or reduced usage when we can’t assign it to another driver.

**Example:** Client E left in the middle of the month. We might have planned £20k from them and got £10k. The £10k shortfall is revenue we can’t explain by Volume, Price, FX, or Timing alone — it’s classified as Unknown churn. Ideally this stays small; if it’s large, it’s worth investigating.

---

### FX (Foreign exchange)

**Presenter:** FX is the impact of exchange rate changes when we convert revenue from local currency to our reporting currency (e.g. GBP or USD).

**Example:** Client F pays in EUR. We planned at 1.15 EUR/GBP and actual was 1.12. That means fewer GBP per EUR, so revenue in GBP is lower than it would have been at plan rates — a negative FX impact. A weaker GBP (higher EUR/GBP) would increase GBP revenue.

---

### Residual

**Presenter:** Residual is the balancing figure. It’s whatever is left after we’ve explained the variance through the other drivers. Rounding differences, model mismatches, or items we don’t separately track end up here.

**Example:** If the sum of Fixed fee, Volume, Price, Timing, Unknown churn, and FX explains 98% of the gap, the remaining 2% is Residual. In a well-maintained model, Residual should be small. If it’s large, we need to refine the model or data.

---

## 5. Driver Contribution Table (Ranked)

**Presenter:** Below the waterfall you’ll see the **Driver Contribution** table. It ranks drivers by their contribution to variance in absolute terms and shows each driver’s share of total variance.

The last row highlights the Residual share. If Residual is a large proportion of total variance, that’s a signal to revisit assumptions or data quality.

You can **click a driver row** to open the same client-level breakdown modal as when you click a bar in the waterfall.

---

## 6. Key Insights & Highlights

**Presenter:** This section pulls in qualitative commentary from our source sheet — positive highlights and challenges or risks.

- **Positive Highlights** — wins, outperformance, favourable developments.
- **Challenges & Risks** — issues, underperformance, risks we’re tracking.

This gives context that the numbers alone don’t show. For example, we might see “Strong transaction volume from Ivy” as a positive and “Concerning negative tendencies in February in terms of volume” as a challenge.

---

## 7. FP&A Charts Section

**Presenter:** The lower part of the dashboard has several charts:

- **Variance by driver** — stacked or grouped view of how each driver affects the total variance.
- **Variance trend** — how variance evolves month over month (e.g. Jan vs Feb).
- **Top & bottom contributors** — clients with the largest positive and negative variance contributions.
- **Plan vs Actual (clients)** — scatter plot of plan vs actual by client. Points above the line beat plan; points below underperform.
- **Revenue mix** — share of revenue from Existing Clients vs New Clients.

These support deeper analysis and quick identification of outliers.

---

## 8. Data Source and Refresh

**Presenter:** The dashboard reads from a Google Sheet. If you see “Data from Google Sheet” at the top, you’re looking at live data. If you see “Sample data,” the sheet could not be loaded — for example, if it’s not shared as “Anyone with the link can view” or if there’s a connection issue.

There’s also a diagnostic button to run connectivity checks.

---

## 9. Summary and Q&A

**Presenter:** To recap: the dashboard shows Plan vs Actual, breaks down the variance into six main drivers — Fixed fee, Volume, Price, Timing, Unknown churn, and FX — plus Residual, and lets you drill into each driver at the client level. You can switch between Existing Clients and New Clients, choose the month and view type, and see both quantitative bridges and qualitative insights.

Happy to take questions or do a quick live demo of any specific part.

---

*End of transcript*
