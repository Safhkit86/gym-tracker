import type { DashboardStats } from "@gym-tracker/shared";
import { usePager } from "../hooks/usePager";
import { useIsNarrowViewport } from "../hooks/useIsNarrowViewport";
import { PagerControls } from "./PagerControls";
import type { MuscleGroupSummary } from "../utils/muscle-groups";

const MUSCLE_GROUP_CAROUSEL_QUERY = "(max-width: 860px)";

/** Riepilogo statistiche (tile + volume per gruppo muscolare della
 *  settimana): condiviso tra Dashboard e la pagina Statistiche, stessi dati
 *  identici in entrambe. */
export function StatisticheCard({
  stats,
  muscleGroupVolume,
}: {
  stats: DashboardStats;
  muscleGroupVolume: MuscleGroupSummary[];
}) {
  const isNarrow = useIsNarrowViewport(MUSCLE_GROUP_CAROUSEL_QUERY);
  const pageSize = isNarrow ? 1 : 3;
  const pager = usePager(muscleGroupVolume, pageSize);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Statistiche</h2>
      </div>
      <div className="stat-tiles">
        <div>
          <div className="stat-tile__label">Sessioni registrate</div>
          <div className="stat-tile__value">{stats.sessionCount}</div>
        </div>
        <div>
          <div className="stat-tile__label">Settimane consecutive</div>
          <div className="stat-tile__value">{stats.consecutiveWeeks}</div>
        </div>
        <div>
          <div className="stat-tile__label">Kg totali sollevati</div>
          <div className="stat-tile__value">
            {stats.totalKgLifted.toLocaleString("it-IT")}
            <small> kg</small>
          </div>
        </div>
      </div>

      {muscleGroupVolume.length > 0 && (
        <div className="muscle-groups-block">
          <div className="muscle-groups-block__header">
            <h3>Per gruppo muscolare · questa settimana</h3>
            {muscleGroupVolume.length > pageSize && (
              <PagerControls
                start={pager.start}
                pageSize={pageSize}
                total={pager.total}
                canPrev={pager.canPrev}
                canNext={pager.canNext}
                onPrev={pager.prev}
                onNext={pager.next}
                orientation="horizontal"
                prevLabel="Gruppi precedenti"
                nextLabel="Gruppi successivi"
              />
            )}
          </div>
          <div className="muscle-groups">
            {pager.visible.map((mg) => (
              <div className="muscle-group" key={mg.muscleGroup}>
                <h3>{mg.muscleGroup}</h3>
                <div className="row">
                  <span>Serie</span>
                  <strong>{mg.setCount}</strong>
                </div>
                <div className="row">
                  <span>Ripetizioni</span>
                  <strong>{mg.repCount}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
