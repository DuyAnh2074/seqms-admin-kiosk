const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Serve HTML forms with customer data prefill
router.get('/:templateName', (req, res) => {
  try {
    const { templateName } = req.params;
    // Point directly to backend/html folder with 26 form files
    let htmlFilePath = path.join(__dirname, '../../html', `${templateName}`);

    // If file doesn't exist, try adding .html extension
    if (!fs.existsSync(htmlFilePath) && !templateName.endsWith('.html')) {
      htmlFilePath = path.join(__dirname, '../../html', `${templateName}.html`);
    }

    if (!fs.existsSync(htmlFilePath)) {
      return res.status(404).json({ error: `Template ${templateName} not found` });
    }

    let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    // Inject customer data from query params
    const customerData = req.query;

    // Replace placeholders with actual data
    Object.keys(customerData).forEach(key => {
      const placeholder = `{{${key.toUpperCase()}}}`;
      const value = customerData[key] || '';
      htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
    });

    // --- FIX LỖI: XÓA CÁC PLACEHOLDER CÒN SÓT LẠI ---
    // Tìm tất cả các chuỗi dạng {{ABC}} còn sót và thay bằng chuỗi rỗng
    htmlContent = htmlContent.replace(/{{[A-Z0-9_]+}}/g, '');
    // ------------------------------------------------

    // --- FIX: TỰ ĐỘNG TÍCH CHECKBOX CHO LOẠI GIẤY TỜ ---
    // Nếu loai_giay_to được gửi, hãy tích checkbox tương ứng
    if (customerData.loai_giay_to) {
      const loaiGiayTo = customerData.loai_giay_to;

      // Tìm checkbox linh hoạt - không phụ thuộc thứ tự attribute
      // Match: <input ... type="checkbox" ... name="loai_giay_to" ... value="[value]" ... >
      const regex = new RegExp(
        `<input\\s+(?=[^>]*type="checkbox")(?=[^>]*name="loai_giay_to")(?=[^>]*value="${loaiGiayTo}")([^>]*)>`,
        'gi'
      );

      let matchCount = 0;
      htmlContent = htmlContent.replace(regex, (match) => {
        matchCount++;
        // Nếu đã có checked, giữ nguyên, nếu chưa thì thêm
        if (match.includes('checked')) {
          console.log(`⏭️  Already checked, skipping`);
          return match;
        }
        const newMatch = match.replace('>', ' checked>');
        return newMatch;
      });

      if (matchCount > 0) {
        console.log(`✅ Auto-checked ${matchCount} checkbox(es) for loai_giay_to="${loaiGiayTo}"`);
      } else {
        console.warn(`⚠️ No checkbox found for loai_giay_to="${loaiGiayTo}". Regex may need adjustment.`);
      }
    }

    // Inject script to communicate with parent window (React)
    const postMessageScript = `
    <script>
      // 1. Báo hiệu Iframe đã sẵn sàng (Handshake)
      window.addEventListener('DOMContentLoaded', () => {
         console.log('🚀 HTML Form DOM Ready');
         if(window.parent) {
             window.parent.postMessage({ type: 'FORM_READY' }, '*');
         }
      });

      // 2. Lắng nghe tin nhắn từ React
      window.addEventListener('message', function(event) {
        
        // --- A. LOGIC KHÔI PHỤC DỮ LIỆU (RESTORE) ---
        if (event.data?.type === 'RESTORE_FORM_DATA') {
          console.log('🔄 Restoring form data...');
          
          const savedData = event.data.data;
          
          if (savedData && savedData.formData) {
            const formData = savedData.formData;
            
            // Restore industry table data
            if (formData.industryRows && Array.isArray(formData.industryRows)) {
              const industryTableBody = document.getElementById('industryTableBody');
              if (industryTableBody) {
                // Get current number of rows
                const existingRows = industryTableBody.querySelectorAll('.industry-row');
                const currentRowCount = existingRows.length;
                const targetRowCount = formData.industryRows.length;
                
                // Add new rows if needed
                while (industryTableBody.querySelectorAll('.industry-row').length < targetRowCount) {
                  addIndustryRow();
                }
                
                // Restore data to each row
                const allRows = industryTableBody.querySelectorAll('.industry-row');
                formData.industryRows.forEach((rowData, rowIndex) => {
                  const row = allRows[rowIndex];
                  if (row) {
                    // Restore textareas
                    const textareas = row.querySelectorAll('textarea');
                    const textareasArray = Array.isArray(rowData.textareas) ? rowData.textareas : rowData;
                    textareasArray.forEach((cellValue, cellIndex) => {
                      if (textareas[cellIndex]) {
                        textareas[cellIndex].value = cellValue || '';
                      }
                    });
                    
                    // Restore checkbox state
                    const checkbox = row.querySelector('.industry-primary-checkbox');
                    const primaryCell = row.querySelector('.industry-primary-cell');
                    if (checkbox && rowData.primaryChecked) {
                      checkbox.checked = true;
                      if (primaryCell) {
                        primaryCell.classList.add('checked');
                      }
                    } else if (checkbox && !rowData.primaryChecked) {
                      checkbox.checked = false;
                      if (primaryCell) {
                        primaryCell.classList.remove('checked');
                      }
                    }
                  }
                });
                
                console.log('Restored industry table with ' + targetRowCount + ' rows');
              }
            }
            
            // Restore location table data (Bảng 5.4)
            if (formData.locationRows && Array.isArray(formData.locationRows)) {
              const locationTableBody = document.getElementById('locationTableBody');
              if (locationTableBody) {
                const existingRows = locationTableBody.querySelectorAll('.location-row');
                const currentRowCount = existingRows.length;
                const targetRowCount = formData.locationRows.length;
                
                // Add new rows if needed
                while (locationTableBody.querySelectorAll('.location-row').length < targetRowCount) {
                  if (typeof addLocationRow === 'function') {
                    addLocationRow();
                  }
                }
                
                // Restore data to each row (excluding province/ward selects - will be restored later)
                const allRows = locationTableBody.querySelectorAll('.location-row');
                formData.locationRows.forEach((rowData, rowIndex) => {
                  const row = allRows[rowIndex];
                  if (row) {
                    const textareas = row.querySelectorAll('textarea');
                    rowData.textareas.forEach((cellValue, cellIndex) => {
                      if (textareas[cellIndex]) {
                        textareas[cellIndex].value = cellValue || '';
                      }
                    });
                  }
                });
                
                console.log('Restored location table with ' + targetRowCount + ' rows');
              }
            }
            
            // Restore member table data (Bảng 7)
            if (formData.memberRows && Array.isArray(formData.memberRows)) {
              const memberTableBody = document.getElementById('memberTableBody');
              if (memberTableBody) {
                const existingRows = memberTableBody.querySelectorAll('.member-row');
                const currentRowCount = existingRows.length;
                const targetRowCount = formData.memberRows.length;
                
                // Add new rows if needed
                while (memberTableBody.querySelectorAll('.member-row').length < targetRowCount) {
                  if (typeof addMemberRow === 'function') {
                    addMemberRow();
                  }
                }
                
                // Restore data to each row
                const allRows = memberTableBody.querySelectorAll('.member-row');
                formData.memberRows.forEach((rowData, rowIndex) => {
                  const row = allRows[rowIndex];
                  if (row) {
                    const textareas = row.querySelectorAll('textarea');
                    rowData.forEach((cellValue, cellIndex) => {
                      if (textareas[cellIndex]) {
                        textareas[cellIndex].value = cellValue || '';
                      }
                    });
                  }
                });
                
                console.log('Restored member table with ' + targetRowCount + ' rows');
              }
            }
            
            // Wait for provinces to be loaded before restoring address dropdowns
            let waitAttempts = 0;
            const maxWaitAttempts = 50; // Max 5 seconds (50 * 100ms)
            
            const waitForProvinces = setInterval(() => {
              waitAttempts++;
              
              if (window.provincesLoaded || waitAttempts >= maxWaitAttempts) {
                clearInterval(waitForProvinces);
                
                // IMPORTANT: Restore location table selects FIRST (Bảng 5.4)
                if (formData.locationRows && Array.isArray(formData.locationRows)) {
                  const locationTableBody = document.getElementById('locationTableBody');
                  if (locationTableBody) {
                    const allRows = locationTableBody.querySelectorAll('.location-row');
                    
                    // Ensure provinces are populated for all location table selects
                    allRows.forEach(row => {
                      const provinceSelect = row.querySelector('[id^="tinh_ddkd_"]');
                      if (provinceSelect && typeof populateProvinceSelect === 'function') {
                        populateProvinceSelect(provinceSelect);
                      }
                    });
                    
                    // Small delay to ensure DOM is updated
                    setTimeout(() => {
                      // Step 1: Restore province selects and trigger change
                      formData.locationRows.forEach((rowData, rowIndex) => {
                        const row = allRows[rowIndex];
                        if (row && rowData.selects) {
                          rowData.selects.forEach(selectData => {
                            if (selectData.id.includes('tinh_ddkd_')) {
                              const select = row.querySelector('#' + selectData.id);
                              if (select && selectData.text) {
                                let found = false;
                                for (let option of select.options) {
                                  if (option.textContent === selectData.text) {
                                    select.value = option.value;
                                    select.dispatchEvent(new Event('change', { bubbles: true }));
                                    found = true;
                                    console.log('Restored location province ' + selectData.id + ': ' + selectData.text);
                                    break;
                                  }
                                }
                                if (!found) {
                                  console.warn('Could not find province option "' + selectData.text + '" in ' + selectData.id);
                                }
                              }
                            }
                          });
                        }
                      });
                      
                      // Step 2: Wait for wards to load, then restore them
                      setTimeout(() => {
                        formData.locationRows.forEach((rowData, rowIndex) => {
                          const row = allRows[rowIndex];
                          if (row && rowData.selects) {
                            rowData.selects.forEach(selectData => {
                              if (selectData.id.includes('xa_ddkd_')) {
                                const select = row.querySelector('#' + selectData.id);
                                if (select && selectData.text) {
                                  let found = false;
                                  for (let option of select.options) {
                                    if (option.textContent === selectData.text) {
                                      select.value = option.value;
                                      found = true;
                                      console.log('Restored location ward ' + selectData.id + ': ' + selectData.text);
                                      break;
                                    }
                                  }
                                  if (!found) {
                                    console.warn('Could not find ward option "' + selectData.text + '" in ' + selectData.id);
                                  }
                                }
                              }
                            });
                          }
                        });
                      }, 500);
                    }, 100);
                  }
                }
                
                // Lấy tất cả các input theo đúng thứ tự như lúc thu thập
                const allElements = document.querySelectorAll('input, select, textarea');
                const provinceElements = [];
                const wardElements = [];
                
                // Separate province and ward elements for sequential restoration
                allElements.forEach((el, index) => {
                    let key = el.id || el.name || ('__idx_' + index);
                    if (!formData.hasOwnProperty(key)) return;
                    
                    if (el.tagName === 'SELECT') {
                        // SKIP location table selects - they will be restored separately from locationRows
                        if (el.id && (el.id.includes('tinh_ddkd_') || el.id.includes('xa_ddkd_'))) {
                            return; // Skip, will be handled in Step 4
                        }
                        
                        if (el.id && (el.id.includes('-province') || el.id.includes('tinh_'))) {
                            provinceElements.push({el, key, value: formData[key]});
                        } else if (el.id && (el.id.includes('-ward') || el.id.includes('xa_'))) {
                            wardElements.push({el, key, value: formData[key]});
                        } else {
                            // Other selects and non-address elements
                            el.value = formData[key];
                        }
                    } else {
                        // Regular inputs and other elements
                        if (el.type === 'radio' || el.type === 'checkbox') {
                            // Handle checkbox groups (multiple checkboxes with same name)
                            if (el.name && Array.isArray(formData[key])) {
                                // formData[key] is array of checked values
                                // Check checkbox value or label text
                                const checkboxValue = el.value || (el.nextSibling && el.nextSibling.textContent ? el.nextSibling.textContent.trim() : 'on');
                                el.checked = formData[key].includes(checkboxValue);
                            } else if (el.type === 'checkbox') {
                                // Single checkbox or checkbox with id
                                el.checked = formData[key] === true || formData[key] === 'true' || formData[key] === el.value || formData[key] === 'on';
                            } else if (el.type === 'radio') {
                                // Radio button
                                el.checked = formData[key] === el.value;
                            }
                        } else {
                            el.value = formData[key];
                        }
                    }
                });
                
                // Step 1: Restore provinces and trigger change events
                provinceElements.forEach(({el, key, value}) => {
                    let found = false;
                    for (let option of el.options) {
                        if (option.textContent === value) {
                            el.value = option.value;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            found = true;
                            console.log('Restored ' + el.id + ': ' + value);
                            break;
                        }
                    }
                    if (!found) {
                        el.dataset.restoreValue = value;
                        console.warn('Could not find option "' + value + '" in ' + el.id);
                    }
                });
                
                // Step 2: Wait for wards to load, then restore them
                // Add a small delay to let change events process and wards load
                setTimeout(() => {
                    wardElements.forEach(({el, key, value}) => {
                        let found = false;
                        for (let option of el.options) {
                            if (option.textContent === value) {
                                el.value = option.value;
                                found = true;
                                console.log('Restored ' + el.id + ': ' + value);
                                break;
                            }
                        }
                        if (!found) {
                            el.dataset.restoreValue = value;
                            console.warn('Could not find ward option "' + value + '" in ' + el.id);
                        }
                    });
                    
                    // Step 3: Sync tree-select-trigger divs with hidden-data-input values
                    // For each hidden-data-input textarea, update the corresponding tree-select-trigger div
                    const hiddenInputs = document.querySelectorAll('.hidden-data-input');
                    hiddenInputs.forEach(hiddenInput => {
                        if (hiddenInput.value) {
                            // Find the wrapper that contains this hidden input
                            const wrapper = hiddenInput.closest('.tree-select-wrapper');
                            if (wrapper) {
                                // Find the trigger div and update its content
                                const triggerDiv = wrapper.querySelector('.tree-select-trigger');
                                if (triggerDiv) {
                                    triggerDiv.textContent = hiddenInput.value;
                                    console.log('Synced tree-select-trigger with value: ' + hiddenInput.value);
                                }
                            }
                        }
                    });
                    
                    // Step 4: Re-initialize TreeSelect for newly added rows
                    initializeTreeSelectForAllRows();
                    
                    console.log('Data restoration complete');
                }, 900); // Wait 900ms for location table wards and other wards to load
              }
            }, 100); // Check every 100ms if provinces are loaded
          }
          return;
        }
        
        // --- B. LOGIC THU THẬP DỮ LIỆU (REQUEST) ---
        if (event.data?.type === 'REQUEST_FORM_DATA') {
          // 1. Clone node để xử lý HTML in ấn
          const docClone = document.cloneNode(true);
          
        
          const requiredMarks = docClone.querySelectorAll('.required-mark');
          requiredMarks.forEach(mark => {
            mark.remove();
          });
         
          const originalInputs = document.querySelectorAll('input, textarea, select');
          const clonedInputs = docClone.querySelectorAll('input, textarea, select');
          
          originalInputs.forEach((input, index) => {
             // Nếu bản clone không tìm thấy phần tử tương ứng (hiếm gặp nếu làm đúng thứ tự), bỏ qua
             if (!clonedInputs[index]) return;
             
             // Đồng bộ value sang attribute cho bản clone (để in PDF)
             if (input.type !== 'radio' && input.type !== 'checkbox') {
                 clonedInputs[index].setAttribute('value', input.value);
                 // Quan trọng cho textarea (như STT, Số nhà...)
                 if (input.tagName === 'TEXTAREA') {
                     clonedInputs[index].innerHTML = input.value;
                     clonedInputs[index].value = input.value; // Đảm bảo cả value property
                 }
             } else if (input.checked) {
                 clonedInputs[index].setAttribute('checked', 'checked');
             }
             
             if (input.tagName === 'SELECT') {
                 const options = clonedInputs[index].querySelectorAll('option');
                 options.forEach(opt => {
                     if (opt.value === input.value) opt.setAttribute('selected', 'selected');
                 });
             }
          });
          // =========================================================================


          // 2. Process address groups (Logic cũ giữ nguyên)
          for (let i = 1; i <= 4; i++) {
            const inputGroup = docClone.getElementById('input_address_group_' + i);
            const printGroup = docClone.getElementById('print_address_group_' + i);
            
            if (inputGroup && printGroup) {
              const provinceSelect = document.getElementById('address-' + i + '-province');
              const wardSelect = document.getElementById('address-' + i + '-ward');
              
              const provinceText = provinceSelect && provinceSelect.selectedIndex > 0 ? 
                                   provinceSelect.options[provinceSelect.selectedIndex].textContent : '';
              const wardText = wardSelect && wardSelect.selectedIndex > 0 ? 
                               wardSelect.options[wardSelect.selectedIndex].textContent : '';
              
              const printProvinceSpan = docClone.getElementById('print_address_' + i + '_province');
              const printWardSpan = docClone.getElementById('print_address_' + i + '_ward');
              
              if (printProvinceSpan) printProvinceSpan.textContent = provinceText;
              if (printWardSpan) printWardSpan.textContent = wardText;
              
              inputGroup.style.display = 'none';
              printGroup.style.display = 'block';
              
              const clonedPrintGroup = docClone.getElementById('print_address_group_' + i);
              if (clonedPrintGroup) {
                clonedPrintGroup.classList.remove('print_address_group');
              }
              
              // Ẩn text placeholder khi không chọn (--Chọn Xã/Phường--, --Chọn Tỉnh/TP--)
              // Nếu Tỉnh trống: ẩn text span
              if (!provinceText && printProvinceSpan) {
                printProvinceSpan.style.display = 'none';
              }
              
              // Nếu Xã trống: ẩn text span
              if (!wardText && printWardSpan) {
                printWardSpan.style.display = 'none';
              }
            }
          }

          // 3. Xử lý Bảng 5.4 (Địa điểm kinh doanh) - Tráo cột & Biến select thành text
          // (Lưu ý: Đoạn này làm thay đổi cấu trúc DOM, nên phải đặt SAU bước đồng bộ input)
          
          const table54 = docClone.getElementById('table-5-4-ddkd'); // Đảm bảo bảng có ID này
          if (table54) {
            // A. Tráo tiêu đề
            const thead = table54.querySelector('thead');
            if (thead) {
              const headerRows = thead.querySelectorAll('tr');
              if (headerRows.length >= 2) {
                const headerRow = headerRows[1]; 
                const headerCells = headerRow.querySelectorAll('th');
                if (headerCells[1] && headerCells[2]) {
                  const tempHtml = headerCells[1].innerHTML;
                  headerCells[1].innerHTML = headerCells[2].innerHTML;
                  headerCells[2].innerHTML = tempHtml;
                }
              }
            }
            
            // B. Tráo dữ liệu body và biến Select thành Text
            for (let i = 1; i <= 3; i++) {
                // Lấy text từ document GỐC (vì bản clone chưa chắc đã giữ state selectedIndex chuẩn sau khi clone)
                const tinhSelectOriginal = document.getElementById('tinh_ddkd_' + i);
                const xaSelectOriginal = document.getElementById('xa_ddkd_' + i);
                
                if (tinhSelectOriginal && xaSelectOriginal) {
                  const tinhText = tinhSelectOriginal.selectedIndex > 0 ? 
                                   tinhSelectOriginal.options[tinhSelectOriginal.selectedIndex].textContent : '';
                  const xaText = xaSelectOriginal.selectedIndex > 0 ? 
                                 xaSelectOriginal.options[xaSelectOriginal.selectedIndex].textContent : '';
                  
                  // Thao tác trên bản Clone
                  const tbody = table54.querySelector('tbody');
                  if (tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    const row = rows[i - 1]; 
                    
                    if (row) {
                      const cells = row.querySelectorAll('td');
                      // cells[3] là Tỉnh (trong HTML gốc), cells[4] là Xã (trong HTML gốc)
                      
                      if (cells[3] && cells[4]) {
                        // Ghi đè innerHTML -> Hành động này xóa mất thẻ <select> trong docClone
                        // Nhưng vì ta đã đồng bộ input ở BƯỚC 1.5 rồi nên không sợ lỗi index nữa
                        
                        // Cột 3 (PDF: Xã): Lấy text Xã điền vào
                        cells[3].innerHTML = '<div style="width: 100%; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.4; padding: 4px;">' + xaText + '</div>';
                        
                        // Cột 4 (PDF: Tỉnh): Lấy text Tỉnh điền vào
                        cells[4].innerHTML = '<div style="width: 100%; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.4; padding: 4px;">' + tinhText + '</div>';
                      }
                    }
                  }
                }
            }
          }
          
          // Xóa các thành phần thừa trên bản clone
          const keyboardContainer = docClone.getElementById('keyboardContainer');
          if (keyboardContainer) keyboardContainer.remove();
          const printBtn = docClone.getElementById('printBtn');
          if (printBtn) printBtn.remove();
          
          // Xóa nút thêm/xóa dòng
          const addIndustryRowBtn = docClone.getElementById('addIndustryRowBtn');
          if (addIndustryRowBtn) addIndustryRowBtn.remove();
          const deleteIndustryRowBtn = docClone.getElementById('deleteIndustryRowBtn');
          if (deleteIndustryRowBtn) deleteIndustryRowBtn.remove();
          
          // 4. Thu thập dữ liệu JSON chuẩn để lưu (cho nút Quay lại)
          const formData = {};
          
          // Thu thập bảng ngành nghề
          const industryTableBody = document.getElementById('industryTableBody');
          if (industryTableBody) {
            const industryRows = [];
            const rows = industryTableBody.querySelectorAll('.industry-row');
            rows.forEach(row => {
              const textareas = row.querySelectorAll('textarea');
              const checkbox = row.querySelector('.industry-primary-checkbox');
              const rowData = {
                textareas: [],
                primaryChecked: checkbox ? checkbox.checked : false
              };
              textareas.forEach(textarea => {
                rowData.textareas.push(textarea.value);
              });
              industryRows.push(rowData);
            });
            formData.industryRows = industryRows;
          }
          
          // Thu thập bảng 5.4 (Địa điểm kinh doanh)
          const locationTableBody = document.getElementById('locationTableBody');
          if (locationTableBody) {
            const locationRows = [];
            const rows = locationTableBody.querySelectorAll('.location-row');
            rows.forEach(row => {
              const textareas = row.querySelectorAll('textarea');
              const selects = row.querySelectorAll('select');
              const rowData = {
                textareas: [],
                selects: []
              };
              textareas.forEach(textarea => {
                rowData.textareas.push(textarea.value);
              });
              selects.forEach(select => {
                rowData.selects.push({
                  id: select.id,
                  value: select.value,
                  text: select.selectedIndex > 0 ? select.options[select.selectedIndex].textContent : ''
                });
              });
              locationRows.push(rowData);
            });
            formData.locationRows = locationRows;
          }
          
          // Thu thập bảng 7 (Thành viên)
          const memberTableBody = document.getElementById('memberTableBody');
          if (memberTableBody) {
            const memberRows = [];
            const rows = memberTableBody.querySelectorAll('.member-row');
            rows.forEach(row => {
              const textareas = row.querySelectorAll('textarea');
              const rowData = [];
              textareas.forEach(textarea => {
                rowData.push(textarea.value);
              });
              memberRows.push(rowData);
            });
            formData.memberRows = memberRows;
          }
          
          // Thu thập các input khác
          originalInputs.forEach((el, index) => {
             let key = el.id || el.name || ('__idx_' + index);
             
             if (el.type === 'radio') {
                if (el.checked) formData[key] = el.value;
             } else if (el.type === 'checkbox') {
                // Xử lý multiple checkbox với cùng name
                if (el.name) {
                  // Khởi tạo array nếu chưa có
                  if (!formData[key]) {
                    formData[key] = [];
                  }
                  // Nếu chưa là array, convert thành array
                  if (!Array.isArray(formData[key])) {
                    formData[key] = [formData[key]];
                  }
                  // Thêm value của checkbox này nếu checked
                  // Ưu tiên value attribute, nếu không có thì dùng nextSibling text
                  if (el.checked) {
                    const checkboxValue = el.value || (el.nextSibling && el.nextSibling.textContent ? el.nextSibling.textContent.trim() : 'on');
                    formData[key].push(checkboxValue);
                  }
                } else {
                  // Checkbox không có name (dùng id) - giữ logic cũ
                  formData[key] = el.checked ? true : false;
                }
             } else if (el.tagName === 'SELECT') {
                const selectedOption = el.options[el.selectedIndex];
                if (el.id && (el.id.includes('-province') || el.id.includes('-ward') || 
                              el.id.includes('tinh_') || el.id.includes('xa_'))) {
                  formData[key] = selectedOption ? selectedOption.textContent : '';
                } else {
                  formData[key] = el.value;
                }
             } else {
                formData[key] = el.value;
             }
          });
          
          const fullHTML = '<!DOCTYPE html>\\n' + docClone.documentElement.outerHTML;
          
          window.parent.postMessage({
            type: 'FORM_DATA_RESPONSE',
            data: {
              formData: formData,
              formHTML: fullHTML
            }
          }, '*');
        }
        // --- C. LOGIC INJECT DỮ LIỆU NẶNG (INJECT_LARGE_DATA) ---
        // Xử lý việc tiêm dữ liệu lớn như avatar vào iframe
        if (event.data?.type === 'INJECT_LARGE_DATA') {
          console.log('💾 Receiving large data payload:', event.data.data);
          
          const largeData = event.data.data || {};
          
          // 1. Inject avatar image
          if (largeData.avatar) {
            console.log('🖼️ Injecting avatar image...');
            
            // Find all img elements that might be avatar placeholders
            // Usually img tags with specific id/class or specific alt text
            const avatarImages = document.querySelectorAll(
              'img[id="avatar"], img[class*="avatar"], img[alt*="avatar"], img[alt*="ảnh"], img[class*="photo"]'
            );
            
            if (avatarImages.length > 0) {
              avatarImages.forEach((img, index) => {
                img.src = largeData.avatar;
                console.log('✅ Avatar image injected to element ' + (index + 1));
              });
            } else {
              // Fallback: Try to find input elements or data fields for avatar
              const avatarInputs = document.querySelectorAll(
                'input[name*="avatar"], input[id*="avatar"], textarea[name*="avatar"], textarea[id*="avatar"]'
              );
              
              if (avatarInputs.length > 0) {
                avatarInputs.forEach((input, index) => {
                  input.value = largeData.avatar;
                  console.log('✅ Avatar data injected to input element ' + (index + 1));
                });
              } else {
                // Last resort: Log warning but don't fail
                console.warn('⚠️ No avatar image or input element found. Form may not display avatar.');
              }
            }
          }
        }      });
    </script>
    `;

    // Inject before closing body tag
    htmlContent = htmlContent.replace('</body>', `${postMessageScript}</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    console.error('[HTML-FORMS] Error:', error);
    res.status(500).json({ error: 'Failed to serve HTML form', details: error.message });
  }
});

module.exports = router;
