import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPollById } from '../api/polls.js'
import { toUserMessage } from '../lib/apiError.js'
import * as signalR from '@microsoft/signalr'

export default function PollStatsPage() {
    const { id } = useParams()
    const [poll, setPoll] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                const payload = await getPollById(id)
                setPoll(payload)
            } catch (err) {
                setError(toUserMessage(err))
            }
        }

        void load()

        const connection = new signalR.HubConnectionBuilder()
            .withUrl('https://localhost:7054/pollHub')
            .withAutomaticReconnect()
            .build()

        connection.start()
            .then(() => {
                connection.on('ReceiveStatsUpdate', (surveyId) => {
                    if (String(surveyId) === String(id)) {
                        load()
                    }
                })
            })
            .catch(err => console.error('SignalR Error: ', err))

        return () => {
            connection.stop()
        }
    }, [id])

    return (
        <section className="card">
            <div className="card-head">
                <h2>Статистика опроса (Live)</h2>
                <Link to={`/polls/${id}`} className="soft-btn">Назад</Link>
            </div>

            {poll ? <p className="muted">Опрос: {poll.title}</p> : null}
            {error ? <p className="error-box">{error}</p> : null}

            <div className="stats-grid">
                <div className="photo-placeholder">Живое обновление активно</div>
                <div className="photo-placeholder">Данные обновятся при голосовании</div>
            </div>
        </section>
    )
}