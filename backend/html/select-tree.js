// Industry data - VSIC 2018
const industryData = [
    {
        key: 'I', label: 'I - DỊCH VỤ LƯU TRÚ VÀ ĂN UỐNG', selectable: false,
        children: [
            {
                key: '55', label: '55 - Dịch vụ lưu trú', selectable: false,
                children: [
                    {
                        key: '551', label: '551 - Khách sạn và dịch vụ lưu trú tương tự', selectable: false,
                        children: [
                            {
                                key: '5510', label: '5510 - Khách sạn và dịch vụ lưu trú tương tự', selectable: true,
                                children: [
                                    { key: '55100', label: '55100 - Khách sạn và dịch vụ lưu trú tương tự', selectable: true }
                                ]
                            }
                        ]
                    },
                    {
                        key: '552', label: '552 - Dịch vụ lưu trú ngắn ngày khác', selectable: false,
                        children: [
                            {
                                key: '5520', label: '5520 - Dịch vụ lưu trú ngắn ngày khác', selectable: true,
                                children: [
                                    { key: '55201', label: '55201 - Biệt thự hoặc căn hộ kinh doanh dịch vụ lưu trú ngắn ngày', selectable: true },
                                    { key: '55202', label: '55202 - Nhà khách, nhà nghỉ kinh doanh dịch vụ lưu trú ngắn ngày', selectable: true },
                                    { key: '55203', label: '55203 - Nhà trọ, phòng trọ và các cơ sở lưu trú ngắn ngày tương tự', selectable: true }
                                ]
                            }
                        ]
                    },
                    {
                        key: '553', label: '553 - Hoạt động dịch vụ trung gian cho dịch vụ lưu trú', selectable: false,
                        children: [
                            {
                                key: '5530', label: '5530 - Hoạt động dịch vụ trung gian cho dịch vụ lưu trú', selectable: true,
                                children: [
                                    { key: '55300', label: '55300 - Hoạt động dịch vụ trung gian cho dịch vụ lưu trú', selectable: true }
                                ]
                            }
                        ]
                    },
                    {
                        key: '559', label: '559 - Cơ sở lưu trú khác', selectable: false,
                        children: [
                            {
                                key: '5590', label: '5590 - Cơ sở lưu trú khác', selectable: true,
                                children: [
                                    { key: '55901', label: '55901 - Ký túc xá học sinh, sinh viên', selectable: true },
                                    { key: '55902', label: '55902 - Chỗ nghỉ trọ trên xe lưu động, lều quán, trại dùng để nghỉ tạm', selectable: true },
                                    { key: '55909', label: '55909 - Cơ sở lưu trú khác chưa được phân vào đâu', selectable: true }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                key: '56', label: '56 - Dịch vụ ăn uống', selectable: false,
                children: [
                    {
                        key: '561', label: '561 - Nhà hàng và các dịch vụ ăn uống phục vụ lưu động', selectable: false,
                        children: [
                            {
                                key: '5610', label: '5610 - Nhà hàng và các dịch vụ ăn uống phục vụ lưu động', selectable: true,
                                children: [
                                    { key: '56101', label: '56101 - Nhà hàng, quán ăn, hàng ăn uống (trừ cửa hàng ăn uống thuộc chuỗi cửa hàng ăn nhanh)', selectable: true },
                                    { key: '56102', label: '56102 - Cửa hàng ăn uống thuộc chuỗi cửa hàng ăn nhanh', selectable: true },
                                    { key: '56109', label: '56109 - Dịch vụ ăn uống phục vụ lưu động khác', selectable: true }
                                ]
                            }
                        ]
                    },
                    {
                        key: '562', label: '562 - Cung cấp dịch vụ ăn uống theo hợp đồng không thường xuyên và dịch vụ ăn uống khác', selectable: false,
                        children: [
                            {
                                key: '5621', label: '5621 - Cung cấp dịch vụ ăn uống theo hợp đồng không thường xuyên với khách hàng', selectable: true,
                                children: [
                                    { key: '56210', label: '56210 - Cung cấp dịch vụ ăn uống theo hợp đồng không thường xuyên với khách hàng', selectable: true }
                                ]
                            },
                            {
                                key: '5629', label: '5629 - Dịch vụ ăn uống khác', selectable: true,
                                children: [
                                    { key: '56290', label: '56290 - Dịch vụ ăn uống khác', selectable: true }
                                ]
                            }
                        ]
                    },
                    {
                        key: '563', label: '563 - Dịch vụ phục vụ đồ uống', selectable: false,
                        children: [
                            {
                                key: '5630', label: '5630 - Dịch vụ phục vụ đồ uống', selectable: true,
                                children: [
                                    { key: '56301', label: '56301 - Quán rượu, bia, quầy bar', selectable: true },
                                    { key: '56302', label: '56302 - Quán cà phê, giải khát', selectable: true },
                                    { key: '56309', label: '56309 - Dịch vụ phục vụ đồ uống khác', selectable: true }
                                ]
                            }
                        ]
                    },
                    {
                        key: '564', label: '564 - Hoạt động dịch vụ trung gian cho dịch vụ ăn uống', selectable: false,
                        children: [
                            {
                                key: '5640', label: '5640 - Hoạt động dịch vụ trung gian cho dịch vụ ăn uống', selectable: true,
                                children: [
                                    { key: '56400', label: '56400 - Hoạt động dịch vụ trung gian cho dịch vụ ăn uống', selectable: true }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }
];

function renderTreeNode(node, depth = 0) {
    const nodeClass = node.selectable ? 'tree-node selectable' : 'tree-node disabled';
    const hasChildren = node.children && node.children.length > 0;
    const toggleClass = hasChildren ? 'tree-toggle collapsed' : 'tree-toggle hidden';
    const nodeId = 'tree-node-' + Math.random().toString(36).substr(2, 9);

    let html = `<div class="tree-node ${nodeClass}" style="padding-left: ${12 + depth * 20}px;" data-key="${node.key}" data-selectable="${node.selectable}" data-has-children="${hasChildren}">`;

    if (hasChildren) {
        html += `<span class="${toggleClass}" onclick="toggleNode(event)"></span>`;
    } else {
        html += `<span class="tree-toggle hidden"></span>`;
    }

    html += `<span class="tree-node-label" onclick="handleNodeLabelClick(event)">${node.label}</span>`;
    html += `</div>`;

    if (hasChildren) {
        html += `<div class="tree-children" id="${nodeId}">`;
        node.children.forEach(child => {
            html += renderTreeNode(child, depth + 1);
        });
        html += `</div>`;
    }

    return html;
}

function toggleNode(event) {
    event.stopPropagation();
    const toggle = event.target;
    const nodeDiv = toggle.parentElement;
    const childrenDiv = nodeDiv.nextElementSibling;

    if (childrenDiv && childrenDiv.classList.contains('tree-children')) {
        toggle.classList.toggle('collapsed');
        toggle.classList.toggle('expanded');
        childrenDiv.classList.toggle('visible');
    }
}

/**
 * Hàm helper: Loại bỏ mã số và dấu gạch ngang khỏi label
 * @param {string} label - Label chứa mã số (vd: "5510 - Dịch vụ lưu trú")
 * @returns {string} - Tên ngành không chứa mã (vd: "Dịch vụ lưu trú")
 */
function cleanName(label) {
    const nameStartIndex = label.indexOf(' - ');
    if (nameStartIndex !== -1) {
        return label.substring(nameStartIndex + 3);
    }
    return label;
}

/**
 * Hàm helper: Tìm node trong cây industryData bằng mã ngành
 * @param {string} code - Mã ngành cần tìm (vd: "5510")
 * @param {Array} data - Mảng dữ liệu (mặc định là industryData)
 * @returns {Object|null} - Node nếu tìm thấy, null nếu không
 */
function findIndustryNode(code, data = industryData) {
    for (let item of data) {
        if (item.key === code) {
            return item;
        }
        if (item.children && item.children.length > 0) {
            const found = findIndustryNode(code, item.children);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

function handleNodeLabelClick(event) {
    event.stopPropagation();
    const label = event.target;
    const nodeDiv = label.closest('.tree-node');
    const hasChildren = nodeDiv.getAttribute('data-has-children') === 'true';
    const isSelectable = nodeDiv.getAttribute('data-selectable') === 'true';

    // Ưu tiên 1: Nếu selectable thì cho phép chọn
    if (isSelectable) {
        const wrapper = nodeDiv.closest('.tree-select-wrapper');
        if (wrapper) {
            const fakeInput = wrapper.querySelector('.tree-select-trigger');
            const realInput = wrapper.querySelector('.hidden-data-input');
            const popup = wrapper.querySelector('.tree-select-popup');

            if (fakeInput && realInput) {
                const key = nodeDiv.getAttribute('data-key');
                const labelText = nodeDiv.querySelector('.tree-node-label').textContent;
                const row = wrapper.closest('tr');

                // Kiểm tra cấp độ dựa vào độ dài mã ngành
                if (key.length === 5) {
                    // Xử lý Cấp 5 (5 chữ số)
                    const parentCode = key.substring(0, 4); // Lấy 4 chữ số đầu
                    const parentNode = findIndustryNode(parentCode);

                    if (parentNode) {
                        // Lấy tên Cấp 4 (loại bỏ mã)
                        const parentName = cleanName(parentNode.label);
                        // Lấy tên Cấp 5 (loại bỏ mã)
                        const childName = cleanName(labelText);
                        // Ghép chuỗi theo format: "[Tên Cấp 4]\nChi tiết: [Tên Cấp 5]"
                        const displayName = parentName + '\nChi tiết: ' + childName;

                        // 1. Cập nhật giao diện (Div)
                        fakeInput.textContent = displayName;

                        // 2. Cập nhật dữ liệu ngầm (Textarea)
                        realInput.value = displayName;

                        // 3. Điền mã Cấp 4 vào ô Mã ngành
                        if (row) {
                            const codeInput = row.cells[2].querySelector('textarea');
                            if (codeInput) {
                                codeInput.value = parentCode;
                            }
                        }
                    }
                } else if (key.length === 4) {
                    // Xử lý Cấp 4 (4 chữ số) - Logic cũ
                    const name = cleanName(labelText);

                    // 1. Cập nhật giao diện (Div)
                    fakeInput.textContent = name;

                    // 2. Cập nhật dữ liệu ngầm (Textarea)
                    realInput.value = name;

                    // 3. Điền mã ngành
                    if (row) {
                        const codeInput = row.cells[2].querySelector('textarea');
                        if (codeInput) {
                            codeInput.value = key;
                        }
                    }
                }

                if (popup) {
                    popup.classList.add('hidden');
                }
            }
        }
    }
    // Ưu tiên 2: Nếu không selectable nhưng có children thì cho phép mở rộng/thu gọn
    else if (hasChildren) {
        const toggle = nodeDiv.querySelector('.tree-toggle');
        const childrenDiv = nodeDiv.nextElementSibling;
        if (childrenDiv && childrenDiv.classList.contains('tree-children')) {
            toggle.classList.toggle('collapsed');
            toggle.classList.toggle('expanded');
            childrenDiv.classList.toggle('visible');
        }
    }
}

function initializeTreeSelectForRow(inputElement) {
    if (!inputElement) return;

    // Kiểm tra xem đã init chưa
    if (inputElement.closest('.tree-select-wrapper')) return;

    // Tạo Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-select-wrapper';

    // Chèn wrapper vào trước input gốc
    inputElement.parentNode.insertBefore(wrapper, inputElement);

    // Tạo ô Input GIẢ (DIV)
    const fakeInput = document.createElement('div');
    fakeInput.className = 'tree-select-trigger';

    // Đồng bộ giá trị ban đầu
    fakeInput.textContent = inputElement.value;

    // Đưa div giả vào wrapper
    wrapper.appendChild(fakeInput);

    // Xử lý Input gốc (để lưu dữ liệu ngầm)
    inputElement.classList.add('hidden-data-input');
    inputElement.classList.remove('input-line');

    // Di chuyển input gốc vào trong wrapper
    wrapper.appendChild(inputElement);

    // Tạo Popup
    const popup = document.createElement('div');
    popup.className = 'tree-select-popup hidden';
    popup.innerHTML = '<div style="padding: 8px;">' + industryData.map(node => renderTreeNode(node)).join('') + '</div>';
    wrapper.appendChild(popup);

    // Gắn sự kiện click cho DIV GIẢ
    fakeInput.addEventListener('click', function (e) {
        e.stopPropagation();

        popup.classList.toggle('hidden');

        document.querySelectorAll('.tree-select-popup').forEach(p => {
            if (p !== popup) {
                p.classList.add('hidden');
            }
        });
    });

    // Đóng popup khi click ra ngoài
    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            popup.classList.add('hidden');
        }
    });
}

function initializeTreeSelectForAllRows() {
    const industryTableBody = document.getElementById('industryTableBody');
    if (!industryTableBody) return;

    const rows = industryTableBody.querySelectorAll('.industry-row');
    rows.forEach(row => {
        const nameInput = row.cells[1].querySelector('textarea');
        if (nameInput) {
            initializeTreeSelectForRow(nameInput);
        }
    });
}

function disableKeyboardForIndustryTable() {
    const industryTableBody = document.getElementById('industryTableBody');
    if (!industryTableBody) return;

    const industryTextareas = industryTableBody.querySelectorAll('textarea');
    industryTextareas.forEach(textarea => {
        // Chỉ tắt bàn phím cho các ô KHÔNG PHẢI tree select (STT, Mã ngành, etc.)
        if (!textarea.classList.contains('hidden-data-input')) {
            // Chặn focus để bàn phím ảo không bật
            textarea.addEventListener('focus', function (e) {
                this.blur();
            });

            // Chặn mousedown
            textarea.addEventListener('mousedown', function (e) {
                e.preventDefault();
            });
        }
    });
}

function updateSTT() {
    const industryTableBody = document.getElementById('industryTableBody');
    if (!industryTableBody) return;

    const rows = industryTableBody.querySelectorAll('.industry-row');
    rows.forEach((row, index) => {
        const sttInput = row.cells[0].querySelector('textarea');
        if (sttInput) {
            sttInput.value = index + 1;
        }
    });
}

function addIndustryRow() {
    const industryTableBody = document.getElementById('industryTableBody');
    const deleteIndustryRowBtn = document.getElementById('deleteIndustryRowBtn');

    if (!industryTableBody) return;

    // Tìm dòng mẫu
    const firstRow = industryTableBody.querySelector('.industry-row');
    if (!firstRow) return;

    // Clone dòng
    const newRow = firstRow.cloneNode(true);

    // CLEAN UP: Đưa dòng mới về trạng thái nguyên thủy
    const wrappers = newRow.querySelectorAll('.tree-select-wrapper');
    wrappers.forEach(wrapper => {
        // Lấy textarea ẩn ra
        const hiddenInput = wrapper.querySelector('.hidden-data-input');

        if (hiddenInput) {
            // Khôi phục trạng thái ban đầu
            hiddenInput.classList.remove('hidden-data-input');
            hiddenInput.classList.add('input-line');
            hiddenInput.value = '';

            // Thay thế wrapper bằng textarea sạch
            wrapper.parentNode.replaceChild(hiddenInput, wrapper);
        }
    });

    // Reset các textarea khác
    const otherTextareas = newRow.querySelectorAll('textarea');
    otherTextareas.forEach(ta => ta.value = '');

    // Thêm vào bảng
    industryTableBody.appendChild(newRow);

    // Init lại Tree Select
    const newNameInput = newRow.cells[1].querySelector('textarea');
    initializeTreeSelectForRow(newNameInput);

    // Hiển thị nút xóa nếu > 1 dòng
    const rowCount = industryTableBody.querySelectorAll('.industry-row').length;
    if (rowCount > 1 && deleteIndustryRowBtn) {
        deleteIndustryRowBtn.classList.add('visible');
    }

    updateSTT();
    disableKeyboardForIndustryTable();
}

function deleteIndustryRow() {
    const industryTableBody = document.getElementById('industryTableBody');
    const deleteIndustryRowBtn = document.getElementById('deleteIndustryRowBtn');

    if (!industryTableBody) return;

    const rows = industryTableBody.querySelectorAll('.industry-row');

    if (rows.length <= 1) {
        alert('Phải giữ lại ít nhất 1 dòng để nhập dữ liệu.');
        return;
    }

    rows[rows.length - 1].remove();

    const updatedRows = industryTableBody.querySelectorAll('.industry-row');
    if (updatedRows.length <= 1 && deleteIndustryRowBtn) {
        deleteIndustryRowBtn.classList.remove('visible');
    }

    updateSTT();
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    const addIndustryRowBtn = document.getElementById('addIndustryRowBtn');
    const deleteIndustryRowBtn = document.getElementById('deleteIndustryRowBtn');

    if (addIndustryRowBtn) {
        addIndustryRowBtn.addEventListener('click', addIndustryRow);
    }

    if (deleteIndustryRowBtn) {
        deleteIndustryRowBtn.addEventListener('click', deleteIndustryRow);
    }

    initializeTreeSelectForAllRows();
    updateSTT();
    disableKeyboardForIndustryTable();
});
