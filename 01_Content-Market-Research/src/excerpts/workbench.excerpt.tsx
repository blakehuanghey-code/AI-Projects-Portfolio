// 静态源码选摘，不是可独立运行模块。未收录的类型、连接器和依赖见 README。
// 请勿把此文件接入生产服务；本展示包的离线测试不会导入本文件。

// 源文件 app/workbench/page-support.tsx，第 145 行：AnalysisMetricCells
export function AnalysisMetricCells({ platform, row }: { platform: ResearchPlatform; row: ContentAnalysisRow }) { return platform === "小红书" ? <><td>{ratioText(row.lowFollowerShare)}</td><td>{numberText(row.medianNoteCount)}</td><td>{numberText(row.medianFollowers)}</td><td>{numberText(row.medianLikes)}</td><td>{numberText(row.medianSaves)}</td><td>{numberText(row.medianComments)}</td><td><strong>{numberText(row.medianInteractions)}</strong></td></> : <><td>{ratioText(row.lowFollowerShare)}</td><td>{numberText(row.medianFollowers)}</td><td>{numberText(row.medianReads)}</td><td>{numberText(row.medianLikes)}</td><td>{numberText(row.medianComments)}</td><td>{numberText(row.medianShares)}</td><td><strong>{numberText(row.medianInteractions)}</strong></td></>; }

// app/workbench/content-market-workbench.tsx 第 231—232 行，组件体内片段。
  const contentAnalysis = useMemo(() => analysisDimension === "赛道" ? trackAnalysis : buildContentAnalysis(analysisCandidates, analysisDimension), [analysisCandidates, analysisDimension, trackAnalysis]);
  const contentDistribution = useMemo(() => [...contentAnalysis].sort((a, b) => b.count - a.count || (b.medianInteractions ?? -1) - (a.medianInteractions ?? -1)), [contentAnalysis]);

// app/workbench/content-market-workbench.tsx 第 747—755 行，组件体内片段。
                const rows = normalizeSearchResults(platform, normalizedPayload, { ...context, mode: "平台条件" }); let added = 0;
                for (const candidate of rows) {
                  if (!sortRows.has(candidate.id)) { sortRows.add(candidate.id); added += 1; }
                  const old = platformRows.get(candidate.id);
                  if (old) platformRows.set(candidate.id, { ...old, searchSorts: [...new Set([...(old.searchSorts ?? []), sortLabel])], requestSignatures: [...new Set([...old.requestSignatures, signature])] });
                  else if (platformRows.size < targetQuota) platformRows.set(candidate.id, { ...candidate, searchRank: platformRows.size + 1, searchSorts: [sortLabel], requestSignatures: [signature] });
                  if (sortRows.size >= perSortQuota) break;
                }
                if (!rows.length) { stopReasons.push(`${platform}没有返回更多结果`); break; }

// app/workbench/content-market-workbench.tsx 第 890 行，补全结果进入规则初筛。
          incoming.push(...completedRows.map((candidate) => applyContentClassification(candidate)));

// app/workbench/content-market-workbench.tsx 第 893—898 行，采集结束后合并工作台状态。
        job.callSignatures = [...new Set(job.callSignatures)]; job.addedCandidates = incoming.length; job.status = collectionJobStatus({ budgetStopped, fatalBatchFailure, skippedUncertain, incomingCount: incoming.length, requiredFieldsStopped, taskFailed });
        job.resultSummary = `上限 ${targetQuota} 条／平台；本次新增或合并 ${incoming.length} 条${stopReasons.length ? `；停止原因：${[...new Set(stopReasons)].join("；")}` : "；已达到所选平台上限"}${routeNotes.length ? `；接口路由：${[...new Set(routeNotes)].join("；")}` : ""}。`;
        updateCollectionProgress({ stage: `${taskLabel} · 保存候选`, current: targetIndex + 1, total: collectionTargets.length, detail: `${context.keyword} · 写入本地候选池和调用账本` }, true);
        const observedAt = now();
        const observations = incoming.map((candidate) => candidateObservation(candidate, executionBatchId, observedAt));
        setState((current) => ({ ...current, candidates: mergeCandidates(current.candidates, incoming), jobs: upsertJob(current.jobs, job), calls: mergeCalls(current.calls, callRecords), observations: mergeCandidateObservations(current.observations ?? [], observations) }));

// app/workbench/content-market-workbench.tsx 第 1152—1152 行，组件体内片段。
        <div className="distribution-list">{contentDistribution.map((row) => <div key={row.contentType} className={row.recommendation === "待人工判断" ? "pending" : ""}><div><strong>{row.contentType}</strong><span>{row.count} 条 · {ratioText(row.share)}</span></div><div className="distribution-track"><span style={{ width: row.share ? `${Math.max(row.share * 100, 2)}%` : "0" }}/></div></div>)}</div>

// app/workbench/content-market-workbench.tsx 第 1156—1156 行，组件体内片段。
        <div className="table-wrap"><table className="analysis-table"><thead><tr><th>评估结果</th><th>{contentDimensionLabel(analysisDimension)}</th><AnalysisScoreHeaders/><th>样本量／占比</th><AnalysisMetricHeaders platform={analysisPlatform}/></tr></thead><tbody>{contentAnalysis.map((row) => <tr key={row.contentType}><td><AssessmentCell row={row} dimension={analysisDimension}/></td><td><strong>{row.contentType}</strong></td><AnalysisScoreCells row={row}/><td>{row.count}／{ratioText(row.share)}</td><AnalysisMetricCells platform={analysisPlatform} row={row}/></tr>)}</tbody></table></div>
