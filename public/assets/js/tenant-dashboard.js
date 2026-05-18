function initTenantDashboard() {
  const SR = window.SR;
  if (!SR || !SR.api) return;

  const leasesEl = document.querySelector('[data-tenant-leases]');
  const payEl = document.querySelector('[data-tenant-payments]');
  const maintEl = document.querySelector('[data-tenant-maintenance]');
  const inquiriesEl = document.querySelector('[data-tenant-inquiries]');
  const overviewEl = document.querySelector('[data-tenant-overview]');

  function showErr(el, e) {
    if (!el) return;
    el.innerHTML = `<p class="muted">${SR.escapeHtml(e.message || 'Could not load this section')}</p>`;
  }

  async function load() {
    try {
      const overview = await SR.api('/tenant/overview');
      if (overviewEl) {
        if (overview.message) {
          overviewEl.innerHTML = `<p class="muted">${SR.escapeHtml(overview.message)}</p>`;
        } else {
          overviewEl.innerHTML = `
            <div class="metrics-grid" style="margin-top:0;">
              <article class="metric-card card-hover"><h3>Active leases</h3><strong>${overview.active_leases}</strong><span class="muted">Linked to your tenant record</span></article>
              <article class="metric-card card-hover"><h3>Payments to settle</h3><strong>${overview.upcoming_payments}</strong><span class="muted">Not marked as paid</span></article>
              <article class="metric-card card-hover"><h3>Open maintenance</h3><strong>${overview.open_maintenance}</strong><span class="muted">In progress or pending</span></article>
            </div>`;
        }
      }
    } catch (e) {
      showErr(overviewEl, e);
    }

    try {
      const { leases } = await SR.api('/tenant/leases');
      if (!leasesEl) return;
      if (!leases.length) {
        leasesEl.innerHTML = '<p class="muted">No lease records found. Browse <a href="properties.html">available properties</a> or contact your property manager.</p>';
      } else {
        leasesEl.innerHTML = `
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Property</th><th>Unit</th><th>Status</th><th>Rent</th><th>Term</th></tr></thead>
                <tbody>
                  ${leases.map(l => `
                    <tr>
                      <td>${SR.escapeHtml(l.property_name)} <span class="muted">· ${SR.escapeHtml(l.city || '')}</span></td>
                      <td>${SR.escapeHtml(l.unit_code)}</td>
                      <td><span class="badge ${l.contract_status === 'Active' ? 'success' : 'warning'}">${SR.escapeHtml(l.contract_status)}</span></td>
                      <td>${SR.formatPrice(l.monthly_rent)}</td>
                      <td class="muted">${new Date(l.start_date).toLocaleDateString()} – ${new Date(l.end_date).toLocaleDateString()}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
      }
    } catch (e) {
      showErr(leasesEl, e);
    }

    try {
      const { payments } = await SR.api('/tenant/payments');
      if (!payEl) return;
      if (!payments.length) {
        payEl.innerHTML = '<p class="muted">No payment history yet.</p>';
      } else {
        payEl.innerHTML = `
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Date</th><th>Property</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  ${payments.map(p => `
                    <tr>
                      <td>${p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                      <td>${SR.escapeHtml(p.property_name)} · ${SR.escapeHtml(p.unit_code)}</td>
                      <td>${SR.formatPrice(p.amount_paid)}</td>
                      <td><span class="badge ${p.payment_status === 'Paid' ? 'success' : 'warning'}">${SR.escapeHtml(p.payment_status || '')}</span></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
      }
    } catch (e) {
      showErr(payEl, e);
    }

    try {
      const { requests } = await SR.api('/tenant/maintenance');
      if (!maintEl) return;
      if (!requests.length) {
        maintEl.innerHTML = '<p class="muted">No maintenance tickets on file.</p>';
      } else {
        maintEl.innerHTML = `
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Date</th><th>Property</th><th>Issue</th><th>Status</th></tr></thead>
                <tbody>
                  ${requests.map(r => `
                    <tr>
                      <td>${r.request_date ? new Date(r.request_date).toLocaleDateString() : '—'}</td>
                      <td>${SR.escapeHtml(r.property_name || '')}</td>
                      <td>${SR.escapeHtml((r.issue_description || '').slice(0, 80))}${(r.issue_description || '').length > 80 ? '…' : ''}</td>
                      <td><span class="badge">${SR.escapeHtml(r.request_status || '')}</span></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
      }
    } catch (e) {
      showErr(maintEl, e);
    }

    try {
      const { inquiries } = await SR.api('/tenant/inquiries');
      if (!inquiriesEl) return;
      if (!inquiries.length) {
        inquiriesEl.innerHTML = '<p class="muted">No inquiry submissions yet. Browse properties and send an inquiry to a landlord.</p>';
      } else {
        inquiriesEl.innerHTML = `
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Date</th><th>Property</th><th>Contact</th><th>Message</th></tr></thead>
                <tbody>
                  ${inquiries.map(i => `
                    <tr>
                      <td>${i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}</td>
                      <td>${SR.escapeHtml(i.property_name || '')} <span class="muted">· ${SR.escapeHtml(i.unit_code || '')}</span></td>
                      <td>${SR.escapeHtml(i.full_name || '')}<br><span class="muted">${SR.escapeHtml(i.email || '')}</span></td>
                      <td>${SR.escapeHtml((i.message || 'No message provided').slice(0, 80))}${(i.message || '').length > 80 ? '…' : ''}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
      }
    } catch (e) {
      showErr(inquiriesEl, e);
    }
  }

  load();
}
