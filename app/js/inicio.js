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
    
    editingProductCode = null;  // Limpiar la variable de código
}


function showProductManagement() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    loadProducts(); // Cargar productos
}

function generateReport() {
    const pdfContainer = document.getElementById('pdfContainer');
    const pdfViewer = document.getElementById('pdfViewer');

    // Mostrar el contenedor del PDF
    pdfContainer.style.display = 'block';

    // Cargar el PDF generado en tiempo real
    pdfViewer.src = 'http://localhost:5000/productos/reporte';

    // Ocultar el menú una vez seleccionado
    document.getElementById('mainMenu').style.display = 'none';
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

function returnToMenu() {
    document.getElementById('mainMenu').style.display = 'block';
    document.getElementById('appContent').style.display = 'none';
    document.getElementById('pdfContainer').style.display = 'none';
}

function openProductModal() {
    editingProductCode = null;  // Restablecer la variable para agregar un nuevo producto
    productModal.style.display = 'block';
}


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

// Actualizar la carga de productos para reflejar los nuevos datos
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
                <td>${product.nombre}</td>
                <td>${product.descripcion}</td>
                <td>${product.stock}</td>
                <td>${product.precio_unitario}</td>
                <td>${product.categoria}</td>
                <td><img src="${product.imagen}" width="50"></td>
            `;
            productList.appendChild(row);
        });

        updatePagination(data.total_pages, page);
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
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

// Cargar los detalles del producto para editar
async function loadProductForEditing() {
    const codigo = document.getElementById('editProductCode').value;

    if (codigo) {
        try {
            const response = await fetch(`http://localhost:5000/productos/${codigo}`);
            if (!response.ok) throw new Error('Producto no encontrado');

            const product = await response.json();
            // Rellenar el formulario con los datos del producto
            document.getElementById('editName').value = product.nombre;
            document.getElementById('editDescription').value = product.descripcion;
            document.getElementById('editPrice').value = product.precio_unitario;
            document.getElementById('editCategory').value = product.categoria;
            document.getElementById('editImage').value = product.imagen;

            editingProductCode = codigo; // Guardar el código del producto en edición
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

    if (!editingProductCode) {
        alert('No se ha seleccionado un producto para editar.');
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/productos/${editingProductCode}`, {
            method: 'PUT',
            body: JSON.stringify(productData),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            loadProducts(currentPage);
            closeModal();
            resetProductModals(); // Limpiar los campos de los modales
        } else {
            throw new Error('Error al actualizar el producto');
        }
    } catch (error) {
        console.error('Error al actualizar el producto:', error);
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
        nombre: document.getElementById('name').value,
        descripcion: document.getElementById('description').value,
        precio_unitario: parseFloat(document.getElementById('price').value),
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


document.getElementById('detailProductForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const codigo = document.getElementById('detailProductCode').value;

    if (!codigo) {
        alert('Por favor, introduce un código.');
        return;
    }

    try {
        // Obtener datos del producto
        const productResponse = await fetch(`http://localhost:5000/productos/${codigo}`);
        if (!productResponse.ok) throw new Error('Producto no encontrado');

        const product = await productResponse.json();

        // Obtener lotes del producto
        const lotesResponse = await fetch(`http://localhost:5000/productos/${codigo}/lotes`);
        if (!lotesResponse.ok) throw new Error('No se encontraron lotes para este producto');

        const lotesData = await lotesResponse.json();

        // Renderizar información del producto y lotes
        const detailContainer = document.getElementById('detailProductInfo');
        detailContainer.innerHTML = `
            <h2>Producto: ${product.nombre}</h2>
            <p><strong>Descripción:</strong> ${product.descripcion}</p>
            <p><strong>Categoría:</strong> ${product.categoria}</p>
            <p><strong>Precio Unitario:</strong> ${product.precio_unitario}</p>
            <p><strong>Stock Total:</strong> ${product.stock}</p>
            <h3>Lotes:</h3>
            <table border="1">
                <thead>
                    <tr>
                        <th>Lote</th>
                        <th>Fecha de Vencimiento</th>
                        <th>Stock</th>
                    </tr>
                </thead>
                <tbody>
                    ${lotesData.lotes
                        .map(
                            lote => `
                            <tr>
                                <td>${lote.lote}</td>
                                <td>${lote.fecha_vencimiento}</td>
                                <td>${lote.stock}</td>
                            </tr>
                        `
                        )
                        .join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        alert(error.message);
    }
});

function returnToProductManagement() {
    document.getElementById('detailTab').style.display = 'none'; // Ocultar la sección de detalle
    document.getElementById('productManagement').style.display = 'block'; // Mostrar la sección de gestión de productos
}


// Inicializar la carga de productos al cargar la página
loadProducts();
