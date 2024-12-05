from flask import Flask, request, Response, jsonify, render_template, session
from flask_mysqldb import MySQL
from flask_cors import CORS
from MySQLdb import DatabaseError
from flask import send_from_directory
from flask_bcrypt import Bcrypt
import hashlib
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from io import BytesIO

import os

app = Flask(__name__)
CORS(app)

app.config['MYSQL_HOST'] = os.getenv('DB_HOST', 'db')  # Host de la base de datos
app.config['MYSQL_USER'] = os.getenv('DB_USER', 'sep_user')  # Usuario
app.config['MYSQL_PASSWORD'] = os.getenv('DB_PASSWORD', 'sep_password')  # Contraseña
app.config['MYSQL_DB'] = os.getenv('DB_NAME', 'sep_productos')  # Nombre de la base de datos
app.config['MYSQL_PORT'] = int(os.getenv('DB_PORT', 3306))  # Puerto

mysql = MySQL(app)
bcrypt = Bcrypt(app)

# Llave secreta para sesiones (importante para proteger las cookies de sesión)
app.secret_key = '5dd5f3d3b8c8e07e4f08398dd3a3e2c7'  # Una clave aleatoria fuerte


@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

@app.route('/')
def index():
    return render_template('inicio.html')

# Función auxiliar para obtener el conteo total de productos
def get_product_count():
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT COUNT(*) FROM productos")
    return cursor.fetchone()[0]

# Validación de campos requeridos
def validate_fields(data, required_fields):
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return False, missing_fields
    return True, []



@app.route('/productos/reporte', methods=['GET'])
def generate_pdf_report():
    try:
        # Obtener los parámetros de filtro de la URL
        codigo = request.args.get('codigo', default=None)  # Si no se especifica, toma None
        producto = request.args.get('producto', default=None)
        categoria = request.args.get('categoria', default=None)
        stock_min = request.args.get('stockMin', type=int, default=None)
        stock_max = request.args.get('stockMax', type=int, default=None)

        # Si los parámetros son vacíos, asignar valores predeterminados para que no afecten la consulta
        if not codigo:
            codigo = '%'
        if not producto:
            producto = '%'
        if not categoria:
            categoria = '%'
        if stock_min is None:
            stock_min = 0
        if stock_max is None:
            stock_max = 999999

        # Construir la consulta SQL con filtros, asegurando que solo se apliquen si tienen valores
        query = """
            SELECT * FROM productos 
            WHERE (%s = '%%' OR codigo LIKE %s) 
            AND (%s = '%%' OR producto LIKE %s)
            AND (%s = '%%' OR categoria LIKE %s)
            AND stock BETWEEN %s AND %s
        """
        cursor = mysql.connection.cursor()
        cursor.execute(query, (codigo, codigo, producto, producto, categoria, categoria, stock_min, stock_max))
        products = cursor.fetchall()

        # Crear un archivo PDF en memoria
        pdf_buffer = BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        width, height = letter

        # Título del reporte
        c.setFont("Times-Bold", 20)  # Times New Roman en negrita para el título
        c.drawString(200, height - 40, "Reporte de Productos Filtrados")
        c.setFont("Times-Roman", 10)  # Times New Roman para texto normal

        # Encabezados de tabla
        headers = ["Código", "Producto", "Descripción", "Stock", "Precio", "Categoría"]
        x_start = 40
        y_start = height - 80
        line_height = 20

        # Anchos de las columnas ajustados
        column_widths = [50, 130, 160, 80, 80, 100]

        # Dibujar los encabezados en negrita
        c.setFont("Times-Bold", 12)  # Fuente en negrita para los encabezados
        for i, header in enumerate(headers):
            c.drawString(x_start + sum(column_widths[:i]), y_start, header)

        # Contenido de la tabla
        y_start -= line_height
        c.setFont("Times-Roman", 10)  # Fuente normal para las filas
        for product in products:
            # Intercambiar valores de "Código" y "Producto"
            codigo = product[0]  # Antes "Producto"
            producto = product[1]  # Antes "Código"
            descripcion = product[2]
            stock = product[3]
            precio = product[4]
            categoria = product[5]

            # Dividir descripción en líneas de máximo 3 palabras
            palabras = descripcion.split()
            lineas_descripcion = [
                " ".join(palabras[i:i+3]) for i in range(0, len(palabras), 3)
            ]

            # Generar las filas con los valores ajustados
            valores = [producto, codigo, lineas_descripcion, stock, precio, categoria]
            for i, value in enumerate(valores):
                if i == 2:  # Si es la columna "Descripción"
                    # Dibujar las líneas alineadas a la izquierda
                    for j, linea in enumerate(value):
                        c.drawString(
                            x_start + sum(column_widths[:i]),
                            y_start - (j * 10),
                            linea
                        )
                else:
                    c.drawString(
                        x_start + sum(column_widths[:i]),
                        y_start,
                        str(value)
                    )
            y_start -= line_height + (10 * (len(lineas_descripcion) - 1))

            # Salto de página si llega al final
            if y_start < 50:
                c.showPage()
                y_start = height - 80

                # Redibujar encabezados en negrita
                c.setFont("Times-Bold", 12)
                for i, header in enumerate(headers):
                    c.drawString(x_start + sum(column_widths[:i]), y_start, header)
                y_start -= line_height

                # Cambiar la fuente nuevamente para las filas
                c.setFont("Times-Roman", 10)

        c.save()
        pdf_buffer.seek(0)

        # Enviar el PDF como respuesta
        return Response(pdf_buffer, mimetype='application/pdf', headers={'Content-Disposition': 'inline; filename="reporte_productos_filtrados.pdf"'})

    except Exception as e:
        return jsonify({'error': 'Error al generar el PDF', 'details': str(e)}), 500



@app.route('/productos/<int:codigo>', methods=['GET'])
def get_product(codigo):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT * FROM productos WHERE codigo = %s", (codigo,))
        product = cursor.fetchone()
        if not product:
            return jsonify({'message': 'Producto no encontrado'}), 404

        # Ajuste del mapeo según el orden de las columnas en la tabla
        return jsonify({
            'producto': product[0],  # Nombre del producto
            'codigo': product[1],  # Código del producto
            'descripcion': product[2],  # Descripción
            'stock': product[3],  # Stock
            'precio_unitario': float(product[4]),  # Precio unitario
            'categoria': product[5],  # Categoría
            'imagen': product[6]  # URL de la imagen
        })
    except DatabaseError as db_err:
        return jsonify({'error': 'Error en la base de datos', 'details': str(db_err)}), 500
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500


@app.route('/productos', methods=['GET'])
def get_products():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 8))
        offset = (page - 1) * limit

        cursor = mysql.connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM productos")
        total_products = cursor.fetchone()[0]

        # Verificar si la página solicitada es válida
        total_pages = -(-total_products // limit)  # Cálculo del techo
        if page > total_pages or page < 1:
            return jsonify({
                'error': 'Página no válida',
                'total_pages': total_pages,
                'current_page': page
            }), 400

        # Obtener los productos de la página solicitada
        cursor.execute("SELECT * FROM productos LIMIT %s OFFSET %s", (limit, offset))
        products = cursor.fetchall()

        return jsonify({
            'products': [{
                'codigo': row[1],
                'producto': row[0],
                'descripcion': row[2],
                'stock': row[3],
                'precio_unitario': float(row[4]),
                'categoria': row[5],
                'imagen': row[6]
            } for row in products],
            'total_pages': total_pages,
            'current_page': page
        })
    except DatabaseError as db_err:
        return jsonify({'error': 'Error en la base de datos', 'details': str(db_err)}), 500
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500



@app.route('/productos', methods=['POST'])
def add_product():
    try:
        data = request.json
        print("Datos recibidos para agregar el producto:", data)  # Log para verificar los datos recibidos

        required_fields = ['producto', 'descripcion', 'stock', 'precio_unitario', 'categoria', 'imagen']
        valid, missing_fields = validate_fields(data, required_fields)

        if not valid:
            return jsonify({'error': 'Faltan campos requeridos', 'missing_fields': missing_fields}), 400

        cursor = mysql.connection.cursor()
        cursor.execute("SELECT MAX(codigo) FROM productos")
        result = cursor.fetchone()
        next_code = (result[0] or 0) + 1

        cursor.execute(
            "INSERT INTO productos (codigo, producto, descripcion, stock, precio_unitario, categoria, imagen) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (next_code, data['producto'], data['descripcion'], data['stock'], data['precio_unitario'], data['categoria'], data['imagen'])
        )
        mysql.connection.commit()
        return jsonify({'message': 'Producto agregado', 'codigo': next_code}), 201
    except DatabaseError as db_err:
        return jsonify({'error': 'Error en la base de datos', 'details': str(db_err)}), 500
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500




@app.route('/productos/<int:codigo>', methods=['PUT'])
def update_product(codigo):
    try:
        # Obtén los datos enviados desde el frontend
        data = request.json
        print("Datos recibidos para actualizar:", data)  # Log para verificar los datos recibidos

        # Verificación de los campos requeridos
        required_fields = ['producto', 'descripcion', 'stock', 'precio_unitario', 'categoria', 'imagen']
        valid, missing_fields = validate_fields(data, required_fields)

        if not valid:
            return jsonify({'error': 'Faltan campos requeridos', 'missing_fields': missing_fields}), 400

        # Verifica si el producto existe en la base de datos
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT * FROM productos WHERE codigo = %s", (codigo,))
        product = cursor.fetchone()

        if not product:
            return jsonify({'error': 'Producto no encontrado'}), 404

        # Realiza la actualización en la base de datos
        cursor.execute(
            "UPDATE productos SET producto = %s, descripcion = %s, stock = %s, precio_unitario = %s, categoria = %s, imagen = %s WHERE codigo = %s",
            (data['producto'], data['descripcion'], data['stock'], data['precio_unitario'], data['categoria'], data['imagen'], codigo)
        )
        mysql.connection.commit()

        # Respuesta de éxito
        return jsonify({'message': 'Producto actualizado exitosamente'}), 200

    except DatabaseError as db_err:
        return jsonify({'error': 'Error en la base de datos', 'details': str(db_err)}), 500
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500





@app.route('/productos/<int:codigo>', methods=['DELETE'])
def delete_product(codigo):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("DELETE FROM productos WHERE codigo = %s", (codigo,))
        mysql.connection.commit()
        return jsonify({'message': 'Producto eliminado'})
    except DatabaseError as db_err:
        return jsonify({'error': 'Error en la base de datos', 'details': str(db_err)}), 500
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500
    

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Faltan datos'}), 400

        cursor = mysql.connection.cursor()
        cursor.execute("SELECT id, password FROM usuarios WHERE username = %s", (username,))
        user = cursor.fetchone()

        if user:
            user_id, hashed_password = user
            # Si usaste MD5 para almacenar la contraseña, usa esto (aunque no es seguro para producción):
            if hashed_password == hashlib.md5(password.encode()).hexdigest():
                session['user_id'] = user_id
                return jsonify({'message': 'Inicio de sesión exitoso'}), 200
            else:
                return jsonify({'error': 'Credenciales incorrectas'}), 401
        else:
            return jsonify({'error': 'Usuario no encontrado'}), 404
    except Exception as e:
        print(f"Error en /login: {e}")  # Registra el error en la consola
        return jsonify({'error': 'Error interno'}), 500


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
