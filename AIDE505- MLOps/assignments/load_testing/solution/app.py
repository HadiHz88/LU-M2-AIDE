"""Flask web layer: routes, sessions and HTML pages. Business logic lives in auth.py."""
import os

from flask import Flask, flash, redirect, render_template, request, session, url_for

from auth import AuthError, UserStore


def create_app(store: UserStore | None = None, testing: bool = False) -> Flask:
    """App factory: every call returns a fresh app with its own in-memory store."""
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-secret")
    app.config["TESTING"] = testing
    users = store if store is not None else UserStore()

    @app.get("/")
    def index():
        if session.get("user"):
            return redirect(url_for("welcome"))
        return redirect(url_for("login"))

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if request.method == "POST":
            try:
                name = users.register(request.form.get("username", ""),
                                      request.form.get("password", ""))
            except AuthError as err:
                flash(str(err), "error")
                return render_template("form.html", mode="register"), 400
            flash(f"Account created for {name}. Please log in.", "success")
            return redirect(url_for("login"))
        return render_template("form.html", mode="register")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "")
            if users.login(username, request.form.get("password", "")):
                session["user"] = username.strip().lower()
                return redirect(url_for("welcome"))
            flash("Invalid username or password", "error")
            return render_template("form.html", mode="login"), 401
        return render_template("form.html", mode="login")

    @app.get("/welcome")
    def welcome():
        user = session.get("user")
        if not user:
            return redirect(url_for("login"))
        return render_template("welcome.html", user=user)

    @app.post("/logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))

    return app


if __name__ == "__main__":
    create_app().run(debug=True)
