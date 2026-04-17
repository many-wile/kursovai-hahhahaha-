import { useParams } from 'react-router-dom'

export default function PollStatsPage() {
  const { id } = useParams()
  return (
    <section className="panel">
      <h1>Статистика опроса #{id}</h1>
      <p className="muted">Здесь будет отображаться статистика голосования (реализуется после разработки API).</p>
    </section>
  )
}