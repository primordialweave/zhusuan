import { useNavigate } from 'react-router-dom'
import ScenePage, { BrushStroke } from '@/components/scene/ScenePage'
import { Button, RouterButton } from '@/design-system'
import '@/styles/not-found.css'

/** React Router records how deep the current entry sits in this app's own history. */
const hasPreviousEntry = () =>
  typeof window !== 'undefined' &&
  Number((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0

export default function NotFoundView() {
  const navigate = useNavigate()

  return (
    <ScenePage align="center" labelledBy="not-found-title">
      <p className="not-found__numerals">404</p>
      <BrushStroke />
      <h1 className="scene-page__title" id="not-found-title">
        页面走丢了
      </h1>

      <div className="not-found__actions">
        <RouterButton fullWidth size="lg" to="/dashboard">
          返回首页
        </RouterButton>
        {hasPreviousEntry() ? (
          <Button fullWidth onClick={() => void navigate(-1)} variant="outline">
            返回上一页
          </Button>
        ) : null}
      </div>

      <p className="not-found__footer">
        <i aria-hidden="true" className="ri-drizzle-line" />
        <span>雨雾未散，路径可重寻</span>
      </p>
    </ScenePage>
  )
}
