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
        cursor = mysql.connection.cursor()
        cursor.execute("""
            SELECT codigo_producto, nombre_producto, descripcion, stock_total, precio_unitario, categoria
            FROM v_stock_productos
        """)
        products = cursor.fetchall()

        # Crear un archivo PDF en memoria
        pdf_buffer = BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        width, height = letter

        # Título del reporte
        c.setFont("Times-Bold", 20)  # Times New Roman en negrita para el título
        c.drawString(200, height - 40, "Reporte de Productos Actuales")
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
            codigo = product[0]
            nombre = product[1]
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
            valores = [codigo, nombre, lineas_descripcion, stock, precio, categoria]
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
        return Response(pdf_buffer, mimetype='application/pdf', headers={'Content-Disposition': 'inline; filename="reporte_productos.pdf"'})

    except Exception as e:
        return jsonify({'error': 'Error al generar el PDF', 'details': str(e)}), 500




@app.route('/productos/<int:codigo>', methods=['GET'])
def get_product(codigo):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            SELECT codigo_producto, nombre_producto, descripcion, precio_unitario, categoria, imagen, stock_total
            FROM v_stock_productos
            WHERE codigo_producto = %s
            """,
            (codigo,)
        )
        product = cursor.fetchone()
        if not product:
            return jsonify({'message': 'Producto no encontrado'}), 404

        return jsonify({
            'codigo': product[0],
            'nombre': product[1],
            'descripcion': product[2],
            'precio_unitario': float(product[3]),
            'categoria': product[4],
            'imagen': product[5],
            'stock': product[6]
        })
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500


@app.route('/productos', methods=['GET'])
def get_products():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 8))
        offset = (page - 1) * limit

        cursor = mysql.connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM v_stock_productos")
        total_products = cursor.fetchone()[0]

        total_pages = -(-total_products // limit)
        if page > total_pages or page < 1:
            return jsonify({
                'error': 'Página no válida',
                'total_pages': total_pages,
                'current_page': page
            }), 400

        cursor.execute(
            """
            SELECT codigo_producto, nombre_producto, descripcion, precio_unitario, categoria, imagen, stock_total
            FROM v_stock_productos
            LIMIT %s OFFSET %s
            """,
            (limit, offset)
        )
        products = cursor.fetchall()

        return jsonify({
            'products': [
                {
                    'codigo': row[0],
                    'nombre': row[1],
                    'descripcion': row[2],
                    'precio_unitario': float(row[3]),
                    'categoria': row[4],
                    'imagen': row[5],
                    'stock': row[6]
                } for row in products
            ],
            'total_pages': total_pages,
            'current_page': page
        })
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500
    

@app.route('/productos/<int:codigo>/lotes', methods=['GET'])
def get_product_lotes(codigo):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            SELECT lote, fecha_vencimiento, stock_lote, precio_unitario, categoria
            FROM v_stock_lotes
            WHERE codigo_producto = %s
            """,
            (codigo,)
        )
        lotes = cursor.fetchall()
        if not lotes:
            return jsonify({'message': 'No se encontraron lotes para este producto'}), 404

        return jsonify({
            'lotes': [
                {
                    'lote': row[0],
                    'fecha_vencimiento': row[1].strftime('%Y-%m-%d'),
                    'stock': row[2],
                    'precio_unitario': float(row[3]),
                    'categoria': row[4]
                } for row in lotes
            ]
        })
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500    



@app.route('/productos', methods=['POST'])
def add_product():
    try:
        data = request.json
        required_fields = ['nombre', 'descripcion', 'categoria', 'precio_unitario', 'imagen']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({'error': 'Faltan campos requeridos', 'missing_fields': missing_fields}), 400

        cursor = mysql.connection.cursor()

        cursor.execute(
            "INSERT INTO productos (nombre, descripcion, categoria, precio_unitario, imagen) VALUES (%s, %s, %s, %s, %s)",
            (data['nombre'], data['descripcion'], data['categoria'], data['precio_unitario'], data['imagen'])
        )
        mysql.connection.commit()

        return jsonify({'message': 'Producto agregado', 'codigo': cursor.lastrowid}), 201
    except Exception as e:
        return jsonify({'error': 'Error interno', 'details': str(e)}), 500




@app.route('/productos/<int:codigo>', methods=['PUT'])
def update_product(codigo):
    try:
        data = request.json
        allowed_fields = ['nombre', 'descripcion', 'categoria', 'precio_unitario', 'imagen']
        updates = {field: data[field] for field in allowed_fields if field in data}

        if not updates:
            return jsonify({'error': 'No hay campos válidos para actualizar'}), 400

        set_clause = ", ".join([f"{field} = %s" for field in updates.keys()])
        values = list(updates.values()) + [codigo]

        cursor = mysql.connection.cursor()
        cursor.execute(f"UPDATE productos SET {set_clause} WHERE codigo = %s", values)
        mysql.connection.commit()

        return jsonify({'message': 'Producto actualizado correctamente'}), 200
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
