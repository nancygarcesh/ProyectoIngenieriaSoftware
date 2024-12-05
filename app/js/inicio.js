const productList = document.getElementById('productList');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const closeModalButton = document.getElementById('closeModalButton');
const editProductButton = document.getElementById('editProductButton');
const deleteProductButton = document.getElementById('deleteProductButton');
let currentPage = 1;
let editingProductCode = null; // Variable para almacenar el código del producto que estamos editando


document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('loginModal');
    const mainMenu = document.getElementById('mainMenu');
    const appContent = document.getElementById('appContent');
    const token = localStorage.getItem('token');

    if (token) {
        loginModal.style.display = 'none';
        mainMenu.style.display = 'block';
    } else {
        loginModal.style.display = 'block';
        mainMenu.style.display = 'none';
    }

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                localStorage.setItem('token', 'active');
                loginModal.style.display = 'none';
                mainMenu.style.display = 'block';
            } else {
                throw new Error('Credenciales incorrectas');
            }
        } catch (error) {
            console.error('Error al iniciar sesión:', error.message);
        }
    });
});


function resetProductModals() {
    // Resetear el formulario de agregar producto
    document.getElementById('productForm').reset();
    
    // Resetear el formulario de editar producto
    document.getElementById('editProductForm').reset();
    document.getElementById('editProductCode').readOnly = false; // Habilitar la edición del código
    
    // Resetear el formulario de eliminar producto
    document.getElementById('deleteProductForm').reset();
    
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    
    // Mostrar solo la pestaña de agregar (si es necesario)
    document.getElementById('addTab').style.display = 'block';
}


// Función para mostrar la gestión de productos
function showProductManagement() {
    stopMenuBackground(); // Detener el fondo dinámico
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    loadProducts(); // Cargar productos
}


function generateReport() {
    stopMenuBackground(); // Detener el fondo dinámico
    const pdfContainer = document.getElementById('pdfContainer');
    const pdfViewer = document.getElementById('pdfViewer');

    pdfContainer.style.display = 'block';
    pdfViewer.src = 'http://localhost:5000/productos/reporte';
    document.getElementById('mainMenu').style.display = 'none';
}

// Mostrar el modal de filtros
function showFilterModal() {
    document.getElementById('filterModal').style.display = 'block';
}

// Cerrar el modal de filtros
function closeFilterModal() {
    document.getElementById('filterModal').style.display = 'none';
}

// Aplicar los filtros y actualizar el PDF
function applyFilters() {
    const formData = new FormData(document.getElementById('filterForm'));
    const query = new URLSearchParams(formData).toString();
    const pdfViewer = document.getElementById('pdfViewer');

    // Actualizar la URL del iframe con los filtros
    pdfViewer.src = `http://localhost:5000/productos/reporte?${query}`;

    // Cerrar el modal después de aplicar los filtros
    closeFilterModal();
}


function logout() {
    localStorage.removeItem('token');
    location.reload();
}

function returnToMenu() {
    document.getElementById('mainMenu').style.display = 'block';
    document.getElementById('appContent').style.display = 'none';
    document.getElementById('pdfContainer').style.display = 'none';
    startMenuBackground(); // Reiniciar el fondo dinámico
}

function openProductModal() {
    editingProductCode = null;  // Restablecer la variable para agregar un nuevo producto
    productModal.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        startMenuBackground();
    }
});


function openEditProductModal() {
    document.getElementById('productModal').style.display = 'flex';  // Mostrar el modal
    openTab('edit');  // Abrir la pestaña de "Editar Producto"
}

function openDeleteProductModal() {
    document.getElementById('productModal').style.display = 'flex';  // Mostrar el modal
    openTab('delete');  // Abrir la pestaña de "Eliminar Producto"
}

function openTab(tab) {
    var tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(function (tabContent) {
        tabContent.style.display = 'none';
    });
    document.getElementById(tab + 'Tab').style.display = 'block';
}


function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}


document.getElementById('logoutButton').addEventListener('click', () => {
    // Borra el token del almacenamiento local
    localStorage.removeItem('token');

    // Recarga la página para volver al login
    location.reload();
});

// Cargar productos
async function loadProducts(page = 1) {
    try {
        const response = await fetch(`http://localhost:5000/productos?page=${page}&limit=8`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener los productos');
        }
        const data = await response.json();

        productList.innerHTML = '';
        data.products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.codigo}</td>
                <td>${product.producto}</td>
                <td>${product.descripcion}</td>
                <td>${product.stock}</td>
                <td>${product.precio_unitario}</td>
                <td>${product.categoria}</td>
                <td><img src="${product.imagen}" width="50"></td>
                <td>
                    <img 
                        src="/static/images/edit_icon.png" 
                        alt="Editar" 
                        title="Editar" 
                        style="cursor: pointer; width: 27px; margin-right: 10px;"
                        onclick="editProduct(${product.codigo})"
                    >
                    <img 
                        src="/static/images/borrar_icon.png" 
                        alt="Borrar" 
                        title="Borrar" 
                        style="cursor: pointer; width: 24px;"
                        onclick="deleteProduct(${product.codigo})"
                    >
                </td>
            `;
            if (product.stock <= 10) {
                row.style.backgroundColor = '#ffcccc'; // Resaltar filas con bajo stock
            }
            productList.appendChild(row);
        });

        updatePagination(data.total_pages, page);
    } catch (error) {
        console.error('Error:', error);
        alert(error.message); // Mostrar un mensaje amigable al usuario
    }
}


// Actualizar paginación
function updatePagination(totalPages, currentPage) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.disabled = i === currentPage;
        button.addEventListener('click', () => loadProducts(i));
        pagination.appendChild(button);
    }
}

// Abrir el modal de edición
function openEditProductModal() {
    document.getElementById('editProductModal').style.display = 'block';
}

// Cerrar el modal de edición
function closeEditProductModal() {
    document.getElementById('editProductModal').style.display = 'none';
    document.getElementById('editProductForm').reset(); // Resetear el formulario
    document.getElementById('editProductCode').readOnly = false; // Habilitar la edición del código
    editingProductCode = null; // Limpiar la variable de código
}

// Función para cargar los detalles del producto cuando se ingresa el código
// Cargar los detalles del producto para editar
async function loadProductForEditing() {
    const codigo = document.getElementById('editProductCode').value;
    
    if (codigo) {
        try {
            const response = await fetch(`http://localhost:5000/productos/${codigo}`);
            if (!response.ok) throw new Error('Producto no encontrado');
            
            const product = await response.json();
            // Rellenar el formulario con los datos del producto
            document.getElementById('editName').value = product.producto;
            document.getElementById('editDescription').value = product.descripcion;
            document.getElementById('editQuantity').value = product.stock;
            document.getElementById('editPrice').value = product.precio_unitario;
            document.getElementById('editCategory').value = product.categoria;
            document.getElementById('editImage').value = product.imagen;

            // Bloquea el campo de código después de cargar los datos
            document.getElementById('editProductCode').readOnly = true;

            editingProductCode = codigo; // Asegurarse de que se guarde el código
        } catch (error) {
            console.error('Error al cargar el producto:', error);
            alert(error.message);
        }
    } else {
        alert('Por favor, introduce un código.');
    }
}



document.getElementById('editProductForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const productData = {
        producto: document.getElementById('editName').value,
        descripcion: document.getElementById('editDescription').value,
        stock: parseInt(document.getElementById('editQuantity').value),
        precio_unitario: parseFloat(document.getElementById('editPrice').value),
        categoria: document.getElementById('editCategory').value,
        imagen: document.getElementById('editImage').value
    };

    try {
        const response = await fetch(`http://localhost:5000/productos/${document.getElementById('editProductCode').value}`, {
            method: 'PUT',
            body: JSON.stringify(productData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Error al guardar los cambios');
        }

        loadProducts(currentPage); // Recargar la lista de productos
        closeModal(); // Cerrar el modal de edición
        resetProductModals();
    } catch (error) {
        alert(error.message);
    }
});



// Función para eliminar el producto
async function deleteProductByCode(codigo) {
    try {
        const response = await fetch(`http://localhost:5000/productos/${codigo}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Error al eliminar el producto');
        loadProducts(currentPage); // Recargar la lista de productos
        closeModal(); // Cerrar el modal
        resetProductModals(); // Limpiar los campos de los modales
    } catch (error) {
        alert(error.message);
    }
}


let menuBackgroundInterval = null;
const menuBackground = document.createElement('div');
menuBackground.classList.add('menu-background');
document.body.appendChild(menuBackground);

// Ruta de las imágenes
const images1 = [
    '/static/images/imagenmenu1.avif',
    '/static/images/imagenmenu2.avif',
    '/static/images/imagenmenu3.avif',
    '/static/images/imagenmenu4.avif',
    '/static/images/imagenmenu5.avif',
    '/static/images/imagenmenu7.avif',
    '/static/images/imagenmenu8.avif',
    '/static/images/imagenmenu9.avif',
    '/static/images/imagenmenu10.avif'
];
let currentImageIndex = 0;

// Función para iniciar el fondo dinámico
function startMenuBackground() {
    menuBackground.style.display = 'block'; // Mostrar el fondo dinámico
    currentImageIndex = 0; // Reiniciar el índice

    // Mostrar inmediatamente la primera imagen
    menuBackground.style.backgroundImage = `url(${images1[currentImageIndex]})`;

    // Cambiar las imágenes cada 2 segundos
    menuBackgroundInterval = setInterval(() => {
        currentImageIndex = (currentImageIndex + 1) % images1.length; // Ciclo infinito
        menuBackground.style.backgroundImage = `url(${images1[currentImageIndex]})`;
    }, 3000);
}

// Función para detener el fondo dinámico
function stopMenuBackground() {
    clearInterval(menuBackgroundInterval); // Detener el cambio de imágenes
    menuBackground.style.backgroundImage = ''; // Restablecer fondo
    menuBackground.style.display = 'none'; // Ocultar el fondo dinámico
    document.body.style.backgroundColor = '#f1f1f1'; // Fondo blanco mármol
}

// Enviar formulario para eliminar producto
document.getElementById('deleteProductForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const codigo = document.getElementById('deleteProductCode').value;
    if (codigo) {
        deleteProductByCode(codigo);  // Llamar la función para eliminar el producto
    }
});


// Enviar formulario para agregar/editar producto
productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const productData = {
        producto: document.getElementById('name').value,
        descripcion: document.getElementById('description').value,
        stock: document.getElementById('quantity').value,
        precio_unitario: document.getElementById('price').value,
        categoria: document.getElementById('category').value,
        imagen: document.getElementById('image').value
    };

    try {
        let response;
        if (editingProductCode) {
            // Actualizar producto
            response = await fetch(`http://localhost:5000/productos/${editingProductCode}`, {
                method: 'PUT',
                body: JSON.stringify(productData),
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // Agregar producto
            response = await fetch('http://localhost:5000/productos', {
                method: 'POST',
                body: JSON.stringify(productData),
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!response.ok) throw new Error('Error al guardar el producto');
        loadProducts(currentPage); // Recargar la lista de productos
        closeModal(); // Cerrar el modal
        resetProductModals(); // Limpiar los campos de los modales
    } catch (error) {
        console.error('Error:', error);
    }
});




// Inicializar la carga de productos al cargar la página
loadProducts();

function editProduct(productCode) {
    // Mostrar solo el modal de edición
    productModal.style.display = 'block';

    // Asegurarse de que solo el formulario de edición esté visible
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById('editTab').style.display = 'block';

    // Cargar automáticamente los datos del producto seleccionado
    fetch(`http://localhost:5000/productos/${productCode}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('No se pudo cargar el producto');
            }
            return response.json();
        })
        .then(product => {
            document.getElementById('editProductCode').value = product.codigo;
            document.getElementById('editName').value = product.producto;
            document.getElementById('editDescription').value = product.descripcion;
            document.getElementById('editQuantity').value = product.stock;
            document.getElementById('editPrice').value = product.precio_unitario;
            document.getElementById('editCategory').value = product.categoria;
            document.getElementById('editImage').value = product.imagen;
        })
        .catch(error => {
            alert(error.message);
        });
}


// Función para eliminar un producto específico
function deleteProduct(productCode) {
    const confirmation = confirm('¿Estás seguro de que deseas eliminar este producto?');
    if (confirmation) {
        fetch(`http://localhost:5000/productos/${productCode}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('No se pudo eliminar el producto');
            }
            alert('Producto eliminado exitosamente');
            loadProducts(currentPage); // Recargar la lista de productos
        })
        .catch(error => {
            alert(error.message);
        });
    }
}
