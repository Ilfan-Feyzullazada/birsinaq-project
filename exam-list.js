document.addEventListener('DOMContentLoaded', () => {
    const examListContainer = document.querySelector('.exam-list');
    const titleElement = document.getElementById('exam-list-title');
    const urlParams = new URLSearchParams(window.location.search);
    const examType = urlParams.get('type');
    const examGrade = urlParams.get('grade');

    if (titleElement) { titleElement.textContent = examGrade && examType ? `${examGrade} üçün ${examType} İmtahanları` : 'Aktiv İmtahanlar'; }
    if (!examType || !examGrade) {
        examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahan növü və ya sinif seçilməyib.</p>';
        return;
    }

    fetch(`/api/exams?type=${encodeURIComponent(examType)}&grade=${encodeURIComponent(examGrade)}`, { credentials: 'include' })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            const is_guest = !ok;
            const exams = data;
            examListContainer.innerHTML = '';
            if (exams.length === 0) {
                examListContainer.innerHTML = '<p style="text-align: center;">Bu kateqoriya üzrə aktiv imtahan tapılmadı.</p>';
                return;
            }
            exams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';
                const priceText = exam.price > 0 ? `${exam.price.toFixed(2)} AZN` : 'Pulsuz';
                let actionHTML;
                if (exam.price <= 0) {
                    const guestParams = is_guest ? '&studentName=Qonaq&studentEmail=guest@birsinaq.az' : '';
                    actionHTML = `<a href="exam-test.html?examId=${exam.id}${guestParams}" class="start-btn">İmtahana Başla</a>`;
                } else if (is_guest) {
                    actionHTML = `<a href="exam-payment.html?examId=${exam.id}&price=${exam.price}" class="payment-btn">İştirak Et</a>`;
                } else {
                    if (exam.is_paid) {
                        actionHTML = `<a href="exam-test.html?examId=${exam.id}" class="start-btn">İmtahana Başla</a>`;
                    } else {
                        actionHTML = `<a href="#" class="payment-btn" data-exam-id="${exam.id}">İştirak Et</a>`;
                    }
                }
                examItem.innerHTML = `<div class="exam-info"><h4>${exam.title}</h4><p>Təşkilatçı: BirSınaq</p></div><div class="exam-actions"><span class="exam-price">${priceText}</span>${actionHTML}</div>`;
                examListContainer.appendChild(examItem);
            });
        })
        .catch(error => {
            examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahanları yükləmək mümkün olmadı.</p>';
        });

    examListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('payment-btn') && e.target.dataset.examId) {
            e.preventDefault();
            const examId = e.target.dataset.examId;
            const button = e.target;
            button.textContent = 'Gözləyin...';
            button.disabled = true;
            fetch('/api/create-payment-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ examId: examId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.paymentUrl) {
                    window.location.href = data.paymentUrl;
                } else {
                    alert('Xəta: ' + (data.error || 'Naməlum xəta'));
                    button.textContent = 'İştirak Et';
                    button.disabled = false;
                }
            });
        }
    });
});