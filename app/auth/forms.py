# app/auth/forms.py
"""
Login form for user authentication.
"""

from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length


class LoginForm(FlaskForm):
    username = StringField(
        "Username",
        validators=[
            DataRequired(message="Username is required."),
            Length(min=2, max=50)
        ]
    )
    password = PasswordField(
        "Password",
        validators=[
            DataRequired(message="Password is required."),
            Length(min=4, max=100)
        ]
    )
    submit = SubmitField("Login")
