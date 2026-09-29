import { routeHref } from '../routing'

export function NotFoundPage() {
  return <div className="page-shell page-error-shell"><div className="page-empty card"><span className="page-empty__icon" aria-hidden="true">?</span><h1>That page is not part of CareLoop</h1><p>Use the navigation to return to your care overview or recorded journeys.</p><a className="btn btn--primary" href={routeHref('/dashboard')}>Back to Dashboard</a></div></div>
}
